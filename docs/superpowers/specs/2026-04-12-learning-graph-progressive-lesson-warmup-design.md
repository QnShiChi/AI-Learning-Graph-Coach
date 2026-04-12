# Learning Graph Progressive Lesson Warmup Design

## Goal

Cải thiện trải nghiệm học khi vào session mới bằng cách để người dùng có thể học ngay 2-3 concept đầu, trong khi backend tiếp tục sinh lesson package cho các concept còn lại ở chế độ nền.

Phase này tập trung vào lesson readiness và loading behavior:

- session mới vẫn phải tạo ra đầy đủ graph và path như hiện tại
- 3 concept đầu theo learning path phải có `lessonPackage` trước khi người dùng vào flow học
- các concept còn lại được warm dần ở background
- nếu background chưa kịp hoàn tất, hệ thống vẫn fallback an toàn về on-demand generation như hiện tại

Phase này không đổi graph generation contract, không thay lesson schema, và không mở rộng sang redesign quiz hoặc voice tutor.

## Problems In Current System

- `createSession()` hiện chỉ persist session, graph, path snapshot, và current concept.
- `lessonPackage` của từng concept được tạo lazy khi người dùng mở concept đó.
- lần đầu chuyển sang concept mới, UI bị rơi vào trạng thái loading trắng vì frontend query theo `conceptId` mới.
- nếu lesson chưa có hoặc payload cũ bị đánh giá bẩn, backend còn phải regenerate ngay lúc người dùng đang chờ.
- kết quả là session tạo nhanh nhưng learning flow bị ngắt nhịp ở các concept đầu tiên.

## Product Decisions

### 1. Session Ready And Lesson Ready Are Different States

`session.status = ready` tiếp tục mang nghĩa:

- session đã được tạo
- graph đã validate
- learning path đã được persist
- current concept đã xác định

Nhưng phase này thêm khái niệm mới ở mức feature behavior:

- `lesson warmup ready`: 3 concept đầu đã có `lessonPackage` dùng được

Người dùng chỉ nên được điều hướng thẳng vào concept learning flow khi warmup tối thiểu này đã hoàn tất.

### 2. Warm The First 3 Concepts Synchronously

Sau khi session được tạo và path snapshot được persist, backend phải sinh lesson package cho 3 concept đầu tiên trong learning path.

Quy tắc:

- dùng đúng thứ tự path hiện tại
- mặc định `warmupCount = 3`
- nếu path có ít hơn 3 concept thì warm toàn bộ
- warmup này phải hoàn tất trước khi API `createSession()` trả thành công

Mục tiêu là bảo đảm người dùng có ngay một đoạn học đủ dài để bắt đầu mà không bị loading mỗi lần bấm concept kế tiếp quá sớm.

### 3. Warm Remaining Concepts In Background

Ngay sau khi warm xong 3 concept đầu, backend tiếp tục warm phần còn lại bằng background process trong cùng instance.

Quy tắc:

- xử lý tuần tự với `concurrency = 1`
- warm theo thứ tự path
- bỏ qua concept nào đã có `lessonPackage` hợp lệ
- không block response trả về cho người dùng
- lỗi ở một concept không được làm dừng toàn bộ hàng đợi

Điều này giữ session entry đủ nhanh nhưng vẫn tăng xác suất khi người dùng bấm tới concept 4, 5, 6 thì lesson đã có sẵn.

### 4. On-Demand Generation Remains As Safety Net

Flow hiện tại `getOrCreateCurrentLessonPackage()` vẫn phải giữ nguyên vai trò nguồn sự thật cuối cùng.

Nếu background warmup:

- chưa chạy tới concept đó
- đang chạy dở
- hoặc fail

thì lúc người dùng mở concept, backend vẫn generate on-demand như hiện tại.

Điều này giúp phase này chỉ là cải thiện UX và latency, không làm feature phụ thuộc cứng vào background worker mới.

### 5. UI Must Distinguish Loading From Missing Warmup

Frontend không được render nhầm lesson cũ cho concept mới.

Behavior mong muốn:

- nếu concept mới đã có payload, render lesson ngay
- nếu concept mới chưa có payload, hiện trạng thái loading rõ ràng cho concept đó
- về sau có thể giữ layout ổn định và skeleton tốt hơn, nhưng phase này chưa cần thay đổi copy hay visual language quá sâu

## Approaches Considered

### Option A: Keep Pure Lazy Generation

Ưu điểm:

- create session nhanh nhất
- không cần background warmup infrastructure
- chi phí AI chỉ phát sinh cho concept người dùng thực sự mở

Nhược điểm:

- trải nghiệm học bị ngắt mạch
- các concept đầu dễ rơi vào loading state đúng lúc người dùng đang khám phá session mới
- khó tạo cảm giác “session đã sẵn sàng để học”

### Option B: Pregenerate Every Concept Before Returning Session

Ưu điểm:

- sau khi vào session, gần như mọi concept đều mở tức thì
- mental model đơn giản hơn vì create session xong là mọi lesson đã sẵn sàng

Nhược điểm:

- create session chậm đáng kể
- token cost tăng mạnh ngay cả với concept người dùng chưa chắc sẽ học
- dễ làm request tạo session dài và mong manh hơn

### Option C: Progressive Warmup

Ưu điểm:

- người dùng học được ngay 3 concept đầu
- session entry vẫn nhanh hơn full pregeneration
- phần lớn các concept còn lại có cơ hội sẵn sàng trước khi người dùng chạm tới
- vẫn giữ fallback an toàn nhờ on-demand generation

Nhược điểm:

- phức tạp hơn pure lazy
- cần thêm trạng thái nội bộ cho background warmup
- vẫn có khả năng user học nhanh hơn warm queue

### Recommendation

Chọn `Progressive Warmup`.

Đây là điểm cân bằng tốt nhất giữa:

- tốc độ vào session
- cảm giác “có thể học ngay”
- chi phí AI
- mức độ thay đổi kiến trúc chấp nhận được trong codebase hiện tại

## Recommended Architecture

Chọn hướng `create session -> persist graph/path -> warm first 3 lessons -> return session -> continue background warmup for the rest`.

## Backend Design

### 1. Warmup Candidate Resolution

Sau khi `pathSnapshot` đã được persist, backend phải xác định lesson warmup order từ path hiện tại.

Nguồn dữ liệu:

- `persistedPathItems`
- concept metadata đã persist trong session graph

Helper mới nên tạo ra:

- `initialConceptIds`: 3 concept đầu theo position
- `backgroundConceptIds`: phần còn lại theo position

Warmup luôn dựa vào path order, không dựa vào danh sách graph thô.

### 2. Synchronous Warmup During Session Creation

Trong `LearningOrchestratorService.createSession()`:

1. normalize input
2. generate và validate graph
3. persist graph
4. persist path snapshot
5. mark session ready
6. warm 3 concept đầu bằng `lessonPackageService.getOrCreateCurrentLessonPackage(...)`
7. trả response

Warmup input phải dùng cùng source of truth như flow mở concept hiện tại:

- `sessionId`
- `conceptId`
- `concept.displayName`
- `concept.description`
- `session.sourceText`
- prerequisite list của concept đó

Không tạo đường generate lesson riêng thứ hai, tránh drift logic giữa prewarm và on-demand.

### 3. Background Warmup Scheduler

Thêm một service nhỏ trong backend, ví dụ `LessonWarmupService`, chịu trách nhiệm:

- enqueue các concept còn lại cho một session
- xử lý tuần tự trong cùng process
- gọi `getOrCreateCurrentLessonPackage()` cho từng concept
- swallow/log lỗi từng concept rồi tiếp tục

Phase đầu không cần job persistence hoặc distributed queue.

Assumption được chấp nhận:

- InsForge backend hiện chạy single-instance cho local/self-hosted flow
- nếu process restart thì queue bị mất
- khi đó on-demand generation sẽ là fallback

### 4. Idempotency And Duplicate Protection

Warmup và on-demand có thể đụng cùng một concept gần như đồng thời.

Do đó flow phải tiếp tục dựa vào logic hiện tại:

- `getCurrentLessonPackage()`
- semantic validation / regeneration rules
- `insertLessonPackage()` với uniqueness constraint hiện có

Nếu lesson đã tồn tại và hợp lệ thì background warmup phải bỏ qua ngay.

### 5. Failure Handling

Failure của warmup không được làm session create fail nếu:

- 3 concept đầu đã warm xong
- hoặc một concept đầu đã có persisted lesson hợp lệ từ trước

Ngược lại, nếu một trong 3 concept đầu không thể warm và cũng chưa có lesson hợp lệ nào, `createSession()` nên fail thay vì trả về một session “học ngay” nhưng thực tế chưa học được.

Background warmup cho phần còn lại:

- log warning/error theo từng concept
- tiếp tục concept kế tiếp
- không thay đổi session status chung

### 6. Optional Warmup Metadata

Phase này có thể hoạt động mà chưa cần public contract mới, nhưng tốt hơn là có metadata nội bộ hoặc API-level nhẹ để frontend/debug biết warmup progress.

Tối thiểu nên có:

- số concept đã có lesson package hiện tại
- tổng số concept trong session

Nếu chưa muốn đổi schema public ngay, phase đầu vẫn có thể defer phần này.

## Frontend Design

### 1. Session Entry Behavior

Sau khi người dùng tạo session thành công, frontend vẫn điều hướng vào session như hiện tại.

Khác biệt mong muốn:

- current concept và 2 concept kế tiếp gần như luôn mở được ngay
- tần suất gặp loading trắng ở giai đoạn đầu của session giảm mạnh

### 2. Concept Switching Behavior

Frontend không được dùng lesson của concept cũ để giả làm lesson của concept mới.

Phase này không yêu cầu redesign lớn, nhưng cần định hướng rõ:

- keep exact concept binding
- loading state chỉ là loading của concept mới
- không được render sai title/payload

### 3. Future-Friendly Hooks

Sau khi backend warmup có mặt, frontend có thể cải thiện dần bằng:

- prefetch next concept query
- giữ layout ổn định hơn khi đổi concept
- hiển thị `x/y lesson đã sẵn sàng`

Những cải thiện này là phase tiếp theo, không phải điều kiện bắt buộc để áp dụng backend warmup.

## Testing Strategy

### Unit Tests

`backend/tests/unit/learning-graph/lesson-package.service.test.ts`

- reuse logic hiện có, không thay đổi contract lesson generation

`backend/tests/integration/learning-graph/session-flow.test.ts`

- create session warm 3 concept đầu trước khi trả response
- background warmup được enqueue cho phần còn lại
- nếu warm 3 concept đầu fail thì session create fail
- nếu background warmup fail ở concept sau thì create session vẫn thành công
- on-demand generation vẫn hoạt động khi concept chưa được background warm xong

Nếu thêm service mới:

`backend/tests/unit/learning-graph/lesson-warmup.service.test.ts`

- enqueue đúng thứ tự path
- skip concept đã có lesson hợp lệ
- tiếp tục chạy khi một concept fail

### Manual Verification

- tạo session mới với 8-10 concept
- vào ngay concept 1, 2, 3 để xác nhận lesson mở tức thì
- chờ ngắn rồi mở concept 4, 5 để xác nhận đa số đã sẵn sàng
- thử trường hợp background chưa xong để đảm bảo fallback on-demand vẫn đúng concept

## Risks And Mitigations

### 1. Session Creation Becomes Slower

Warm thêm 3 lesson đầu chắc chắn làm `createSession()` chậm hơn hiện tại.

Mitigation:

- chỉ warm 3 concept đầu
- warm tuần tự với logic lesson hiện có, không mở rộng sang explanation/quiz
- theo dõi latency thực tế sau khi rollout

### 2. Background Queue Dies On Process Restart

Vì phase đầu dùng in-process queue nên restart sẽ làm mất queue.

Mitigation:

- on-demand generation vẫn là safety net
- warm queue được coi là optimization, không phải source of truth

### 3. Duplicate Work Between Background And On-Demand

User có thể mở concept đúng lúc background đang chuẩn bị cùng concept đó.

Mitigation:

- dựa vào `getCurrentLessonPackage()` và uniqueness constraint hiện có
- chấp nhận một lượng nhỏ duplicate compute thay vì thêm locking phức tạp quá sớm

### 4. False Sense Of Full Readiness

Nếu UI không nói rõ, người dùng có thể nghĩ mọi concept đều đã chuẩn bị xong.

Mitigation:

- phase đầu chưa cần hiển thị progress công khai, nhưng team phải giữ semantic rõ:
  - session ready != all lessons ready
  - warmup ready = first 3 lessons ready

## Rollout Plan

### Phase 1

- backend warm 3 concept đầu đồng bộ
- background warm phần còn lại
- giữ on-demand generation làm fallback

### Phase 2

- frontend prefetch next concept
- loading state mượt hơn khi chuyển concept
- có thể thêm lesson readiness progress trên UI

### Phase 3

- nếu cần cho production quy mô lớn hơn, chuyển background warmup sang persistent job system

## Phase 1 Defaults

- `warmupCount = 3` được hardcode trong phase đầu để giữ scope nhỏ và behavior ổn định.
- chưa expose lesson readiness progress ra public API trong phase đầu; nếu cần quan sát thì dùng log/debug nội bộ.
- session creation trả response sau khi 3 concept đầu warm xong; phần còn lại được enqueue ngay sau đó trong service layer bằng in-process scheduling.

## Recommendation Summary

Triển khai `progressive lesson warmup` với mặc định:

- warm đồng bộ 3 concept đầu theo learning path
- warm nền tuần tự các concept còn lại
- giữ `getOrCreateCurrentLessonPackage()` làm source of truth
- không render sai lesson giữa các concept
- chấp nhận in-process queue ở phase đầu để đổi lấy UX tốt hơn mà không phải nhảy thẳng sang kiến trúc queue phức tạp
