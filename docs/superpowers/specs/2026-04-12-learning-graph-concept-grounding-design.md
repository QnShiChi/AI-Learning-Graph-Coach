# Learning Graph Concept-Specific Grounding Design

## Goal

Ngăn lesson content bị chảy sang concept khác bằng cách cung cấp `grounding` riêng cho từng concept thay vì để lesson generator đọc toàn bộ `session.sourceText`.

Phase này tập trung vào hai việc:

- tạo `source excerpt` và `source highlights` riêng cho từng concept sau khi graph đã được generate
- thêm bleed detection để reject lesson nào đang bám vào concept khác trong cùng session

Phase này không đổi layout UI, không thay graph generation contract hiện tại, và không mở rộng sang visual features.

## Problems In Current System

- `TutorService.generateLessonPackage()` hiện vẫn nhận `session.sourceText` toàn cục cho mọi concept.
- Khi source text chứa nhiều concept liền nhau, model dễ trộn kiến thức của concept A vào lesson của concept B.
- Validation hiện chỉ chặn output rỗng, lặp title, hoặc pseudo-example; nó chưa biết bài đang lẫn nội dung của concept khác.
- Fallback hiện tại giúp tránh bịa bừa, nhưng không xử lý được gốc lỗi grounding.
- Kết quả là người dùng vẫn có thể gặp bài kiểu:
  - concept hiện tại là `Tổ chức giao diện thành component`
  - `importance` nói về `HTML semantic`
  - `corePoints` liệt kê `HTML`, `CSS`, `JavaScript`
  - `technicalExample` rơi vào fallback

## Product Decisions

### 1. Grounding Is Extracted After Graph Generation

Không ép `GraphGenerationService` trả thêm evidence ngay bây giờ.

Thay vào đó, sau khi đã có validated graph, backend sẽ chạy thêm một bước `concept grounding extraction` cho từng concept.

Input:

- `session.sourceText`
- `concept.displayName`
- `concept.description`
- danh sách concept khác trong cùng session

Output cho mỗi concept:

- `sourceExcerpt`
- `sourceHighlights[]`
- `quality`

Điều này giữ graph generation đơn giản hơn, dễ thay đổi logic grounding độc lập, và tránh làm hỏng graph chỉ vì prompt evidence quá nặng.

### 2. Lesson Generation Uses Concept Grounding First

`mainLesson` phải dùng `grounding.sourceExcerpt` làm nguồn chính.

`session.sourceText` chỉ còn là nguồn phụ trong hai trường hợp:

- `grounding.quality` thấp
- excerpt không đủ dữ liệu cho section cần sinh

Điều này buộc lesson generator phải bám vào một vùng text gần với concept hiện tại thay vì nhìn toàn bộ session như hiện nay.

### 3. Bleed Detection Becomes A First-Class Validation Rule

Validation mới không chỉ kiểm tra quality nội tại của lesson, mà còn kiểm tra lesson có đang “thuộc về concept hiện tại” hay không.

Lesson phải bị reject nếu:

- lặp lại tên của concept khác trong cùng session quá nhiều
- `importance`, `corePoints`, hoặc `technicalExample` overlap mạnh với excerpt của concept khác hơn excerpt hiện tại
- `technicalExample` không có overlap đủ với `grounding.sourceHighlights`

Mục tiêu là chặn kiểu lesson “đúng shape, có vẻ học thuật, nhưng học sai concept”.

### 4. Grounding Quality Must Be Visible In Payload

`lessonPackage` cần mang theo metadata grounding để backend và frontend biết bài này được neo tốt ở mức nào.

Contract mới:

- `grounding.sourceExcerpt`
- `grounding.sourceHighlights[]`
- `grounding.quality: 'concept_specific' | 'session_level' | 'weak'`

Phase này metadata này chủ yếu phục vụ validation và debugging. UI chưa cần redesign theo nó, nhưng payload phải có để sau này có thể hiển thị hoặc log rõ trạng thái.

## Recommended Architecture

Chọn hướng `post-graph concept grounding + grounded lesson generation + bleed detection`.

### Why This Direction

- sửa đúng gốc lỗi lesson lẫn concept
- không làm graph generation prompt nặng thêm ngay lập tức
- grounding logic, lesson logic, và validation logic được tách thành các bước rõ ràng
- dễ thêm test deterministic hơn so với việc nhét mọi thứ vào một prompt duy nhất

## Data Contract Changes

### 1. Lesson Package Grounding Metadata

`lessonPackageSchema` thêm:

```ts
const lessonGroundingSchema = z.object({
  sourceExcerpt: z.string(),
  sourceHighlights: z.array(z.string()).default([]),
  quality: z.enum(['concept_specific', 'session_level', 'weak']),
});

export const lessonPackageSchema = z.object({
  version: z.number().int().min(1),
  formatVersion: z.literal(2),
  contentQuality: z.enum(['validated', 'fallback']),
  regenerationReason: z.enum([
    'initial',
    'failed_quiz',
    'simpler_reexplain',
    'prerequisite_refresh',
    'academic_redesign',
  ]),
  grounding: lessonGroundingSchema,
  mainLesson: academicLessonSchema,
  prerequisiteMiniLessons: z.array(...).default([]),
});
```

### 2. Grounding Quality Meaning

- `concept_specific`
  - excerpt được extract đủ rõ cho riêng concept hiện tại
- `session_level`
  - không extract được đoạn riêng đủ tốt, phải dùng session source text rộng hơn
- `weak`
  - source text không đủ tín hiệu để grounding tốt; lesson có thể chỉ ở mức tối thiểu

## Backend Design

### 1. Concept Grounding Extractor

Thêm một bước nội bộ trong `LessonPackageService` hoặc service phụ trợ chuyên trách:

`extractConceptGrounding(input)`

Input:

- concept hiện tại
- danh sách concept khác trong session
- `session.sourceText`

Output:

- `sourceExcerpt`
- `sourceHighlights`
- `quality`

Extractor có thể dùng heuristic có kiểm soát hoặc LLM nhỏ, nhưng phải đảm bảo:

- excerpt ưu tiên những dòng có chứa tên concept hiện tại hoặc mô tả gần nhất
- tránh kéo vào các bullet nói rõ về concept khác
- nếu không thể xác định excerpt riêng, hạ `quality` xuống `session_level` hoặc `weak`

### 2. Lesson Package Service

`LessonPackageService.getOrCreateCurrentLessonPackage()` cần:

1. lấy session source text
2. lấy metadata concept hiện tại
3. lấy danh sách concept khác trong session
4. gọi `extractConceptGrounding()`
5. truyền grounding này vào `TutorService.generateLessonPackage()`

Grounding nên được persist cùng `lessonPackage` để lesson, quiz, explanation, voice tutor dùng lại cùng một nguồn neo.

### 3. Tutor Service Input Changes

`generateLessonPackage()` đổi từ:

- `conceptName`
- `conceptDescription`
- `sourceText`

thành:

- `conceptName`
- `conceptDescription`
- `grounding`
- `sourceText` như nguồn phụ
- danh sách `siblingConceptNames` để bleed detection

Prompt generator phải nói rõ:

- nguồn chính là excerpt của concept hiện tại
- không dùng ý thuộc concept khác trừ khi đó là prerequisite trực tiếp và có ghi rõ
- `technicalExample` phải bám vào highlights của grounding hiện tại

### 4. Bleed Detection Validator

Validator mới cần kiểm tra:

- số lần xuất hiện của sibling concept names trong lesson output
- overlap giữa `mainLesson` và `grounding.sourceHighlights`
- overlap giữa `mainLesson` và sibling concept names/highlights

Nếu lesson:

- nhắc sibling concept nhiều hơn concept hiện tại
- hoặc `importance`/`corePoints` gần hơn với concept khác
- hoặc `technicalExample` không bám grounding hiện tại

thì reject, retry, hoặc fallback.

### 5. Fallback Hierarchy

Fallback không còn chỉ là:

- concept description
- source highlights chung

Mà sẽ theo thứ tự:

1. `grounding.sourceExcerpt`
2. `session.sourceText`
3. minimal safe fallback

Nếu `grounding.quality = weak`, lesson có thể vẫn hợp lệ nhưng phải mang dấu hiệu rõ là chất lượng nền thấp hơn.

## Validation Rules

### Grounding Validation

- excerpt không được rỗng nếu source text không rỗng
- highlights phải là con hoặc bản rút gọn hợp lý từ excerpt/session source
- nếu excerpt không có tín hiệu cụ thể cho concept hiện tại thì quality không được gắn là `concept_specific`

### Bleed Validation

- reject nếu lesson lặp tên concept khác quá ngưỡng cho phép
- reject nếu `importance` nói chủ yếu về mục tiêu của concept khác
- reject nếu `corePoints` chỉ là outline của cả khóa học thay vì ý cốt lõi của concept
- reject nếu `technicalExample` không có lexical overlap đủ với `grounding.sourceHighlights`

### Safe Acceptance Rule

Lesson chỉ được accept là `validated` khi:

- semantic rules cũ pass
- bleed detection pass
- grounding quality không mâu thuẫn với nguồn thật

## Testing Strategy

### Unit Tests

`backend/tests/unit/learning-graph/lesson-package.service.test.ts`

- extract được grounding riêng cho concept `component`
- khi source text quá rộng và không có đoạn riêng thì quality hạ xuống `session_level`

`backend/tests/unit/learning-graph/tutor.service.test.ts`

- lesson cho concept `component` bị reject nếu nhắc `HTML semantic` như trọng tâm
- lesson được accept khi `technicalExample` bám highlights của concept hiện tại
- fallback hierarchy dùng grounding trước rồi mới đến session source

### Integration Tests

`backend/tests/integration/learning-graph/session-flow.test.ts`

- lesson payload có `grounding`
- concept `component` không còn bị bleed từ `HTML semantic`, `CSS layout`, `JavaScript nền tảng`
- `contentQuality` và `grounding.quality` phản ánh đúng case validated/fallback

## Risks And Mitigations

### 1. Grounding Extraction May Still Be Noisy

Mitigation:

- quality levels rõ ràng
- dùng validator để bắt bleed sau bước grounding

### 2. More Token Usage

Mitigation:

- grounding extraction có thể bắt đầu bằng heuristic trước
- chỉ escalate sang model khi heuristic quá yếu

### 3. Too Many Rejections

Mitigation:

- bleed validator chỉ chặn các case rõ ràng
- không reject chỉ vì một sibling concept được nhắc một lần trong ngữ cảnh hợp lệ

## Out Of Scope

- thay đổi graph generation response shape
- redesign UI để hiển thị source excerpt
- thay đổi flow graph overview hoặc node layout
- tối ưu prompt cho voice tutor ngoài việc dùng grounding tốt hơn

## Success Criteria

- lesson cho một concept không còn thường xuyên chứa nội dung cốt lõi của concept khác
- `technicalExample` bám vào excerpt hoặc highlights của chính concept đó
- payload lesson có `grounding` rõ ràng để debug và mở rộng sau này
- session có source text outline dài vẫn sinh ra lesson riêng theo concept tốt hơn hiện tại
