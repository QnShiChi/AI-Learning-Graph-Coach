# Learning Graph Content Generator Quality Design

## Goal

Nâng chất lượng nội dung `mainLesson` trong Learning Graph để bài học chính không chỉ đúng shape mà còn thực sự có giá trị học tập.

Phase này chỉ tập trung vào content generation quality:

- `mainLesson` phải được sinh bằng LLM theo cấu trúc học thuật rõ ràng
- backend phải chặn các output rỗng, lặp title, hoặc giả-ví-dụ bằng validation
- easy explanation khi người dùng bấm phải bám vào lesson học thuật đã validate, nhưng có thể nhìn thêm `sourceText` để diễn đạt mềm hơn

Phase này không đổi lại UI structure, không quay về Feynman cố định, và không mở rộng scope sang graph view hay visual redesign.

## Problems In Current System

- `lessonPackage` đã được đổi sang `mainLesson`, nhưng nội dung bên trong vẫn đang được dựng bằng heuristic tối thiểu.
- `definition` có thể chỉ lặp lại tên concept hoặc một dòng mô tả quá ngắn.
- `importance` hiện có thể chỉ là một bullet trích lại từ source, chưa trả lời được vì sao khái niệm đáng học.
- `technicalExample` đang bị suy diễn bằng keyword match, nên nhiều khi chỉ là câu mô tả khái niệm chứ không phải ví dụ kỹ thuật thực sự.
- `commonMisconceptions` hiện là template cứng, không phản ánh hiểu sai thật sự của concept.
- Khi lesson chính yếu, easy explanation và voice tutor cũng mất nền tảng tốt để diễn giải lại.

## Product Decisions

### 1. LLM Is The Source Of Lesson Content

`TutorService.generateLessonPackage()` phải chuyển từ heuristic assembly sang `LLM-first generation`.

Model phải sinh trực tiếp các field:

- `definition`
- `importance`
- `corePoints`
- `technicalExample`
- `commonMisconceptions`
- `prerequisiteMiniLessons`

Source input vẫn là concept hiện tại, source text, prerequisite context, và regeneration reason. Nhưng output chính phải là lesson được viết có chủ đích, không phải kết quả cắt ghép từ vài dòng text.

### 2. Semantic Validation Is Required

Parse đúng JSON chưa đủ. Backend phải có lớp validation semantic để chặn các output “đúng shape nhưng vô nghĩa”.

Validation cần kiểm tra:

- `definition` không được gần như chỉ lặp lại `conceptName`
- `importance` phải giải thích được giá trị học tập hoặc giá trị thực hành
- `corePoints` phải có ít nhất hai ý phân biệt nhau
- `technicalExample` phải là ví dụ kỹ thuật thật, không phải câu mô tả chung
- `commonMisconceptions` phải là hiểu sai có thể xảy ra, không phải template giáo điều

Nếu fail semantic validation thì lesson không được persist như một output tốt.

### 3. Retry Before Falling Back

Pipeline sinh lesson mới:

1. Gọi model với prompt chuẩn
2. Validate output
3. Nếu fail, retry tối đa 2 lần với feedback chỉ rõ field nào fail và vì sao
4. Nếu vẫn fail, dùng fallback tối thiểu an toàn

Mục tiêu là tránh hiển thị content tệ chỉ vì một lần trả lời lệch, nhưng cũng không để latency và token usage tăng vô hạn.

### 4. Fallback Must Be Safe Minimum, Not Fake Quality

Fallback không được giả vờ là một lesson tốt. Nó chỉ có nhiệm vụ giữ cho hệ thống không gãy và tránh bịa nội dung.

Rule cho fallback:

- chỉ dùng `conceptDescription`, `sourceHighlights`, và source text có sẵn
- không sáng tác analogy hay ví dụ đời thường
- `technicalExample` nếu không có dữ liệu đủ tốt phải nói rõ rằng ví dụ cụ thể chưa được trích rõ từ nguồn hiện tại
- có thể gắn cờ nội bộ `contentQuality: 'validated' | 'fallback'` để biết bài nào cần regenerate lại sau này

### 5. Easy Explanation Uses Lesson First, Source Second

Khi người dùng bấm `Giải thích theo cách dễ hiểu`, backend không đọc một block Feynman được lưu sẵn.

Thay vào đó, `generateExplanation()` sẽ dùng:

- `mainLesson` đã validate làm nguồn chính
- `sourceText` làm nguồn phụ để làm mượt cách diễn đạt khi lesson chính còn ngắn

Rule:

- không được mâu thuẫn với `mainLesson`
- không drift sang concept khác
- được phép diễn đạt đơn giản hơn, chia nhỏ hơn, hoặc thêm ví dụ gần gũi khi hữu ích

## Recommended Architecture

Chọn hướng `LLM-first lesson generation + semantic validation + bounded retry + safe fallback`.

### Why This Direction

- sửa đúng gốc của vấn đề chất lượng nội dung, thay vì chỉ thay schema hoặc UI wording
- giữ `mainLesson` là source of truth có kiểm soát chất lượng tối thiểu
- cải thiện đồng thời lesson chính, easy explanation, voice tutor, và quiz context vì tất cả đều dựa vào một lesson tốt hơn
- vẫn giữ được một đường thoát an toàn khi model trả lời kém hoặc không ổn định

## Backend Design

### 1. Structured LLM Output Contract

Trong `TutorService`, thêm schema nội bộ cho raw LLM output của lesson, tách biệt với persisted lesson package.

Schema này cần map rõ các field model phải trả về:

```ts
const llmAcademicLessonSchema = z.object({
  definition: z.string(),
  importance: z.string(),
  corePoints: z.array(z.string()).min(2),
  technicalExample: z.string(),
  commonMisconceptions: z.array(z.string()).default([]),
  prerequisiteMiniLessons: z.array(
    z.object({
      prerequisiteConceptId: z.string().uuid(),
      title: z.string(),
      content: z.string(),
    })
  ).default([]),
});
```

Schema này chỉ xác nhận shape ban đầu. Semantic quality sẽ được kiểm tra ở bước riêng.

### 2. Prompt Design

Prompt sinh lesson phải nói rõ:

- đây là bài học chính theo văn phong học thuật, không phải Feynman explanation
- `definition` phải giải thích bản chất khái niệm
- `importance` phải nói được vì sao người học cần hiểu khái niệm này
- `corePoints` phải là các ý tách biệt, không lặp từ
- `technicalExample` phải là ví dụ kỹ thuật đúng ngữ cảnh của concept
- `commonMisconceptions` phải là hiểu sai phổ biến hoặc hợp lý

Prompt cũng phải cấm các kiểu output gây loãng chất lượng:

- lặp lại title làm definition
- dùng câu “hiểu vai trò của...” thay cho ví dụ
- chèn analogy mặc định
- viết lan sang concept khác

### 3. Semantic Validator

Thêm validator nội bộ cho lesson output sau khi parse schema.

Validator phải trả về danh sách lỗi theo field, ví dụ:

- `definition is too close to concept title`
- `importance does not explain practical or learning value`
- `technicalExample is descriptive but not an example`

Các lỗi này sẽ được dùng lại trong retry prompt để model biết chính xác cần sửa điểm nào.

### 4. Retry Loop

`generateLessonPackage()` cần có retry loop hữu hạn:

- attempt 1: prompt chuẩn
- attempt 2: prompt kèm validation feedback từ attempt 1
- attempt 3: prompt kèm feedback chặt hơn, yêu cầu chỉ sửa các field fail

Nếu một attempt parse được nhưng fail semantic validation thì không persist output đó. Chỉ lesson nào qua validation mới được đóng gói thành `mainLesson` chất lượng tốt.

### 5. Safe Fallback Builder

Nếu cả ba attempt đều không đạt, backend dùng fallback builder.

Fallback builder phải:

- tạo `definition` từ `conceptDescription` theo cách trung tính
- tạo `importance` từ mục tiêu học tập gần nhất có trong source
- tạo `corePoints` từ `sourceHighlights`, nhưng loại các dòng quá trùng nhau
- chỉ đưa `technicalExample` khi source text có ví dụ đủ rõ; nếu không thì dùng câu cảnh báo trung tính
- tạo `commonMisconceptions` rất tiết chế hoặc để rỗng nếu không có tín hiệu đủ chắc

Fallback builder phải ưu tiên tính đúng và an toàn hơn là độ hay.

### 6. Explanation Generator Update

`generateExplanation()` cần nhận thêm `sourceText` hoặc equivalent source context để tạo lời giải thích dễ hiểu hơn khi người dùng yêu cầu.

Prompt explanation mới phải ưu tiên:

- lesson đã validate
- core points
- technical example

Sau đó mới dùng `sourceText` như nguồn phụ để tìm cách diễn đạt mềm hơn. Nó không được viết lại trái với lesson học thuật đã được chấp nhận.

## Validation Rules

### Definition

- reject nếu gần như giống hệt `conceptName`
- reject nếu quá ngắn và không giải thích vai trò hoặc bản chất
- accept khi nó giúp người học hiểu “khái niệm này là gì” mà không cần đoán

### Importance

- reject nếu chỉ lặp lại definition
- reject nếu chỉ chép một bullet source không gắn với giá trị học tập
- accept khi nó trả lời được “vì sao cần học cái này”

### Core Points

- reject nếu ít hơn 2 ý
- reject nếu nhiều ý nhưng thực chất là cùng một câu viết lại
- accept khi các ý có thể đọc tách riêng mà vẫn bổ sung cho nhau

### Technical Example

- reject nếu chỉ là câu mô tả kiểu “hiểu vai trò của các thẻ...”
- reject nếu không có ngữ cảnh kỹ thuật cụ thể
- accept khi người học có thể chỉ ra “đây là ví dụ minh họa cho concept”

### Common Misconceptions

- reject nếu là template đạo lý hoặc câu cấm đoán chung
- reject nếu chỉ đổi cách viết của definition
- accept khi nó mô tả một kiểu hiểu sai mà người học thực sự có thể mắc

## Testing Strategy

### Unit Tests

`backend/tests/unit/learning-graph/tutor.service.test.ts` cần thêm coverage cho:

- lesson tốt được accept ngay ở lần đầu
- definition lặp title bị reject và trigger retry
- technical example không phải ví dụ thật bị reject
- output parse được nhưng fail semantic validation
- cả ba lần fail thì fallback builder được dùng
- explanation generation ưu tiên `mainLesson` nhưng vẫn nhận `sourceText`

### Integration Tests

`backend/tests/integration/learning-graph/session-flow.test.ts` cần cập nhật expectation để kiểm tra:

- lesson mới có nội dung học thuật usable hơn, không chỉ đúng shape
- easy explanation vẫn hoạt động khi được gọi on demand
- session flow không gãy khi lesson rơi vào fallback

Integration test không cần chứng minh “hay”, nhưng phải chặn regression kiểu lesson chỉ lặp concept name hoặc technical example giả.

## Risks And Mitigations

### 1. Token Cost Increases

LLM-first generation và retry làm tăng chi phí token.

Mitigation:

- chỉ retry tối đa 2 lần
- feedback ngắn và có cấu trúc
- không generate easy explanation trước khi người dùng bấm

### 2. Validation Too Strict

Nếu validator quá chặt, nhiều lesson ổn vẫn bị reject và rơi vào fallback.

Mitigation:

- validator ưu tiên chặn lỗi rõ ràng, không cố “chấm văn”
- test với nhiều case biên trước khi rollout

### 3. Fallback Content May Feel Dry

Fallback an toàn sẽ kém tự nhiên hơn lesson qua validation.

Mitigation:

- chấp nhận điều này có chủ đích
- dùng `contentQuality` để sau này regenerate lại các bài fallback nếu cần

## Out Of Scope

- thay đổi layout UI của lesson page
- thêm hình, metaphor, hoặc visual learning aid trở lại
- thay đổi graph planning logic
- redesign voice tutor beyond việc dùng lesson tốt hơn làm context

## Success Criteria

- lesson chính không còn thường xuyên lặp lại title làm definition
- `technicalExample` không còn là câu mô tả chung trong các case phổ biến
- easy explanation vẫn bám đúng concept nhưng diễn đạt mềm hơn khi người dùng yêu cầu
- backend có thể phân biệt lesson `validated` và lesson `fallback`
- session flow vẫn ổn định khi model trả lời kém
