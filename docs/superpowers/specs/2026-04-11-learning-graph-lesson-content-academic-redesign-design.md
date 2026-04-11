# Learning Graph Lesson Content Academic Redesign Design

## Goal

Chuyển Learning Workspace từ mô hình `lesson = Feynman + metaphor + image mapping` sang mô hình `lesson = nội dung học thuật chuẩn`, trong đó:

- bài học chính phải đúng ngữ nghĩa học thuật và bám sát concept hiện tại
- phần giải thích dễ hiểu chỉ là lựa chọn phụ, được generate khi người dùng chủ động bấm
- voice tutor trả lời theo concept hiện tại và prerequisite liên quan nhưng linh hoạt về cách diễn đạt
- quiz không còn dựa vào `feynmanExplanation` hay analogy mặc định

## Problems In Current System

- `lessonPackage` hiện tại ép mọi concept phải có `feynmanExplanation`, `metaphorImage`, `imageReadingText`, và `imageMapping`.
- `TutorService.inferLessonMetaphor()` đang suy diễn ẩn dụ từ từ khóa trong source text, nên có thể lôi nhầm nội dung như `class/object` vào bài không liên quan.
- `ConceptLessonCard` luôn render ảnh, caption, đọc hình, mapping trực giác sang kỹ thuật, khiến phần lesson chính bị lệch trọng tâm.
- `technicalTranslation` hiện chỉ là một mảnh nội dung nằm cạnh lớp Feynman, thay vì là source of truth cho bài học chính.
- `VoiceTutorService` và quiz context đang dựa vào `feynmanExplanation`, nên toàn bộ experience bị kéo theo cùng một kiểu diễn giải.
- Cơ chế legacy detection hiện tại dựa vào text heuristic, không đủ chắc để phân biệt content format cũ và mới.

## Product Decisions

### 1. Main Lesson Is Academic By Default

Bài học chính phải luôn hiển thị theo cấu trúc học thuật cố định:

1. `Khái niệm là gì`
2. `Vì sao quan trọng`
3. `Thành phần / quy tắc cốt lõi`
4. `Ví dụ kỹ thuật đúng ngữ cảnh`
5. `Lỗi hiểu sai thường gặp`
6. `Prerequisite cần ôn`

Nội dung này là phần người dùng phải đọc đầu tiên và phải đủ để làm quiz mà không cần analogy hay Feynman.

### 2. Easy Explanation Is Optional And Generated On Demand

Không lưu `feynmanExplanation` trong `lessonPackage` nữa.

Thay vào đó:

- người dùng bấm action `Giải thích theo cách dễ hiểu`
- frontend gọi endpoint generate explanation hiện có hoặc endpoint tương đương cho `easy explanation`
- backend generate explanation tại thời điểm đó dựa trên concept hiện tại, lesson học thuật, và prerequisite liên quan
- UI chỉ render section này sau khi người dùng chủ động yêu cầu

Điều này tách hẳn `main lesson` khỏi `learning aid`.

### 3. No Metaphor Image In Default Lesson Flow

Ảnh, caption, image reading, và image mapping bị loại khỏi flow mặc định.

Lý do:

- không còn giá trị học thuật bắt buộc
- làm rối nội dung chính
- tạo false confidence vì image/metaphor có thể lệch khái niệm

Phase này không thay bằng ảnh khác. Bài học mặc định là text-first.

### 4. Voice Tutor Keeps Scope Tight, Not Wording Rigid

Voice tutor vẫn bị giới hạn bởi:

- concept hiện tại
- lesson học thuật hiện tại
- prerequisite liên quan

Nhưng không còn bị ràng buộc vào một đoạn `feynmanExplanation` cố định.

Tutor phải cho phép:

- trả lời ngắn gọn theo đúng câu hỏi người học
- diễn đạt lại đơn giản hơn khi người học yêu cầu
- chia nhỏ theo từng bước
- đưa ví dụ đời thường khi người học trực tiếp yêu cầu

Rule mới là `phạm vi chặt, cách diễn đạt linh hoạt`.

### 5. Quiz Uses Academic Context Only

Quiz generation không còn đọc `feynmanExplanation` hay analogy làm input ưu tiên.

Quiz chỉ bám vào:

- concept name
- concept description
- academic lesson sections
- prerequisites còn thiếu
- mastery hiện tại

Nếu cần ví dụ, quiz chỉ được dùng `technical example` hoặc ví dụ phát sinh từ lesson học thuật mới.

## Recommended Architecture

Chọn hướng `academic lesson package + on-demand easy explanation`.

### Why This Direction

- sửa đúng gốc lỗi dữ liệu, không chỉ che UI
- giữ main lesson rõ ràng, đúng chuẩn học thuật
- vẫn cho phép người học cần cách nói dễ hơn được hỗ trợ theo yêu cầu
- loại bỏ coupling giữa lesson, quiz, và voice tutor với một block Feynman cố định

## Data Contract Changes

### 1. New Lesson Package Shape

`lessonPackageSchema` đổi sang contract học thuật:

```ts
export const lessonPackageSchema = z.object({
  version: z.number().int().min(1),
  formatVersion: z.literal(2),
  regenerationReason: z.enum([
    'initial',
    'failed_quiz',
    'simpler_reexplain',
    'prerequisite_refresh',
    'academic_redesign',
  ]),
  mainLesson: z.object({
    definition: z.string(),
    importance: z.string(),
    corePoints: z.array(z.string()).min(1),
    technicalExample: z.string(),
    commonMisconceptions: z.array(z.string()).default([]),
  }),
  prerequisiteMiniLessons: z.array(
    z.object({
      prerequisiteConceptId: z.string().uuid(),
      title: z.string(),
      content: z.string(),
    })
  ).default([]),
});
```

### 2. Removed Fields

Các field sau bị loại khỏi `lessonPackage`:

- `feynmanExplanation`
- `metaphorImage`
- `imageReadingText`
- `imageMapping`
- `technicalTranslation`

`technicalTranslation` bị thay bằng `mainLesson` có cấu trúc rõ ràng hơn để frontend không còn phải parse text mơ hồ.

### 3. Explanation Contract

`GenerateConceptExplanationResponseSchema` tiếp tục tồn tại nhưng đổi vai trò thành `easy explanation on demand`.

Output phải là một block ngắn, dễ hiểu, bám vào lesson học thuật hiện tại. Nó không phải nội dung persist bắt buộc trong `lessonPackage`.

## Backend Design

### 1. Tutor Service

`TutorService.generateLessonPackage()` phải bỏ toàn bộ logic infer metaphor mặc định và sinh lesson theo prompt học thuật.

Prompt mới cần bắt model trả về:

- `definition`
- `importance`
- `core_points`
- `technical_example`
- `common_misconceptions`
- `prerequisite_mini_lessons`

Ràng buộc bắt buộc:

- đúng concept hiện tại
- không chèn analogy ngoài ngữ cảnh nếu không có trong source
- không viết giọng chat
- không dùng motif giải thích kiểu Feynman làm nội dung chính
- ngắn gọn nhưng đủ cụ thể để làm quiz

`TutorService.generateExplanation()` đổi vai trò thành generator cho phần `Giải thích theo cách dễ hiểu`.

Prompt mới phải nói rõ:

- chỉ generate khi người dùng yêu cầu
- bám vào `mainLesson` và prerequisite
- được diễn đạt đơn giản hơn
- có thể dùng ví dụ đời thường nếu giúp dễ hiểu hơn
- không drift sang concept khác

### 2. Lesson Package Service

`LessonPackageService.getOrCreateCurrentLessonPackage()` cần lazy-regenerate mọi package cũ sang format mới.

Legacy detection mới không dùng heuristic text. Thay vào đó:

- đọc raw payload từ session storage
- nếu payload không có `formatVersion: 2` hoặc không parse được theo schema mới thì xem là legacy
- generate lại package mới với `regenerationReason = 'academic_redesign'`
- persist version kế tiếp

Điều này đảm bảo concept cũ được sửa dần khi người dùng mở vào mà không cần migration script riêng trong phase này.

### 3. Voice Tutor

`VoiceTutorService` không còn nhận `lessonPackage.feynmanExplanation`.

Input context cho prompt đổi thành:

- `conceptName`
- `mainLesson.definition`
- `mainLesson.importance`
- `mainLesson.corePoints`
- `mainLesson.technicalExample`
- prerequisite liên quan
- prior conversation summary
- learner utterance

System prompt phải đổi từ kiểu `chỉ bám vào bài học đang hiển thị` sang:

- trả lời đúng câu hỏi người dùng
- vẫn giữ trong phạm vi concept hiện tại và prerequisites liên quan
- nếu người dùng xin giải thích dễ hiểu thì đơn giản hóa cách nói
- nếu người dùng hỏi vượt quá scope, kéo về concept hiện tại

### 4. Quiz Service

`QuizService` không còn truyền `exampleOrAnalogy: lessonPackage.feynmanExplanation`.

Quiz context mới dùng:

- `explanationSummary` lấy từ các trường `mainLesson`
- `technicalExample` thay cho analogy mặc định
- prerequisites
- mastery

Question mix vẫn có thể có `application` hoặc `misconception`, nhưng không còn nhóm `analogy` là trọng tâm mặc định.

## Frontend Design

### 1. Concept Lesson Card

`ConceptLessonCard` được thiết kế lại thành reading article học thuật:

- header khái niệm
- `Khái niệm là gì`
- `Vì sao quan trọng`
- `Các ý cốt lõi`
- `Ví dụ kỹ thuật`
- `Lỗi hiểu sai thường gặp`
- `Prerequisite cần ôn`
- action row cuối bài

Không còn render:

- image
- caption
- đọc hình
- mapping trực giác sang kỹ thuật
- Feynman block mặc định

### 2. Easy Explanation Section

Thêm một section phụ ngay dưới lesson chính hoặc cuối lesson card:

- mặc định ẩn hoàn toàn
- click `Giải thích theo cách dễ hiểu` mới bắt đầu generate
- khi có kết quả, section bung ra với explanation text
- nếu generate lại lần nữa thì overwrite kết quả cũ

Copy phải nói rõ đây là cách diễn đạt khác, không phải nội dung chính của bài.

### 3. Explanation Card Consolidation

`ConceptExplanationCard` hiện tại không còn nên tồn tại như một card phụ độc lập với semantics mơ hồ.

Thay vào đó:

- hoặc hợp nhất vào `ConceptLessonCard` thành `easy explanation section`
- hoặc đổi component này thành section inline và đổi copy hoàn toàn

Khuyến nghị là hợp nhất để flow đọc liền mạch hơn và tránh trùng CTA với lesson card.

### 4. Button Semantics

Action row cuối lesson cần tách rõ:

- `Giải thích theo cách dễ hiểu`
- `Tôi đã hiểu, cho tôi quiz`

Không dùng label `Giải thích lại` nữa vì label này mơ hồ giữa:

- regenerate lesson chính
- generate explanation phụ

Nếu cần hành vi regenerate lesson chính trong tương lai, đó phải là action quản trị hoặc action khác tên.

### 5. Concept Learning Page Wiring

`ConceptLearningPage` cần:

- bỏ assumption rằng `openingText` cho voice tutor lấy từ `feynmanExplanation`
- truyền academic lesson summary vào voice tutor
- đổi flow để easy explanation section nằm sát lesson chính
- tránh render card explanation cũ nếu đã hợp nhất vào lesson

## Content Rules

### 1. Main Lesson Rules

Main lesson phải:

- đúng concept hiện tại
- dùng ngôn ngữ học thuật rõ ràng
- không trộn analogy vô cớ
- có ví dụ kỹ thuật đúng ngữ cảnh
- có phần misconception để chặn hiểu sai phổ biến

### 2. Easy Explanation Rules

Easy explanation phải:

- ngắn hơn lesson chính
- dễ hiểu hơn lesson chính
- không thay đổi bản chất khái niệm
- không lặp nguyên văn lesson chính
- chỉ là một đường diễn đạt khác cho cùng nội dung

### 3. Voice Tutor Rules

Voice tutor phải:

- trả lời theo câu người dùng hỏi
- không bị kẹt vào một script Feynman có sẵn
- có thể nói dễ hiểu hơn khi người dùng yêu cầu
- không được lan sang chủ đề ngoài phạm vi phiên học hiện tại

## Testing Strategy

### 1. Shared Schema And Service Tests

Thêm hoặc cập nhật test để khóa:

- schema mới parse đúng `mainLesson`
- schema cũ không còn là happy path
- tutor service sinh đúng shape học thuật
- lesson package service regenerate payload legacy sang format mới

### 2. Frontend Component Tests

`ConceptLessonCard` cần test:

- render 6 khối học thuật đúng thứ tự
- không còn image/caption/mapping mặc định
- `Giải thích theo cách dễ hiểu` mặc định chưa hiện nội dung
- click mới generate và hiện easy explanation

### 3. Voice Tutor And Quiz Tests

Test cho voice tutor và quiz phải khóa:

- không còn dependency vào `feynmanExplanation`
- prompt/context lấy từ `mainLesson`
- quiz generation không dùng analogy mặc định

## Risks And Mitigations

### 1. Legacy Payload Compatibility

Rủi ro:

- raw payload cũ không parse được theo schema mới

Giảm thiểu:

- detect payload cũ trước khi parse strict
- regenerate lazily khi load concept

### 2. Consumer Drift

Rủi ro:

- frontend, voice tutor, quiz, và integration tests cùng phụ thuộc lesson shape cũ

Giảm thiểu:

- cập nhật schema trước
- đổi service consumers theo một contract mới thống nhất
- giữ test coverage cho toàn bộ flow concept learning

### 3. Easy Explanation Quality

Rủi ro:

- generate-on-click có thể tạo explanation quá giống lesson chính hoặc lại drift sang analogy kém chính xác

Giảm thiểu:

- prompt chặt
- giới hạn độ dài
- ràng buộc chỉ được bám vào lesson học thuật hiện có và prerequisite liên quan

## Out Of Scope

- migration script quét toàn bộ database một lần
- thay đổi graph view
- thay đổi overall session path logic
- thêm ảnh minh họa mới cho learning workspace
- mở rộng voice tutor sang hỏi đáp ngoài phạm vi concept hiện tại
