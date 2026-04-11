# Learning Graph Concept Learning Workspace Design

## Goal

Biến màn hình học khái niệm hiện tại từ bố cục kiểu dashboard rời rạc thành một trang học tập tập trung vào kiến thức cốt lõi, trong đó nội dung lý thuyết là trung tâm còn phần Feynman và giải thích lại chỉ đóng vai trò hỗ trợ.

## Problems In Current UI

- Bài học chính bị ép vào cột hẹp nên mất nhịp đọc và không còn là trung tâm của trang.
- Phần Feynman đang bị đẩy lên quá mạnh, tạo cảm giác toàn bộ bài học xoay quanh ví dụ trực giác thay vì kiến thức cốt lõi.
- Các card phụ như giải thích lại, quiz, mastery đang cạnh tranh thị giác với phần nội dung học.
- Khối minh họa Feynman phụ thuộc hoàn toàn vào `lesson.metaphorImage.imageUrl`; khi ảnh lỗi hoặc ảnh backend không đủ chất lượng, fallback hiện tại chỉ là text trên nền gradient.
- Mapping giữa hình minh họa và khái niệm kỹ thuật đang hiển thị như danh sách card rời, chưa giúp người học hiểu tiến trình từ trực giác sang kỹ thuật.
- Explanation sinh thêm đang hiển thị như một khối dài liên tục, vừa mang giọng chat vừa làm vỡ flow học khi mở rộng.

## Proposed Layout

### 1. Overall Workspace

- Giữ `LearningPathPanel` ở cột trái nhưng giảm vai trò thị giác và thu hẹp hơn nữa, để nó chỉ làm navigation.
- Bỏ hoàn toàn `right rail` trên desktop; không còn một cột phụ cố định ở bên phải.
- Dành toàn bộ phần còn lại của chiều ngang cho `learning workspace`, để bài học chính chiếm vùng đọc lớn nhất.
- Trong workspace, sắp xếp nội dung theo đúng flow học tự nhiên:
  1. Header khái niệm và trạng thái học
  2. Bài học chính
  3. Giải thích lại
  4. Quiz
  5. Mastery summary

### 2. Recommended Desktop Layout

- Desktop dùng bố cục `2 cột`:
  - cột trái hẹp: `LearningPathPanel`
  - cột phải rộng: toàn bộ `study flow`
- Tỷ lệ mục tiêu:
  - Path: khoảng `220-240px`
  - Study flow: chiếm toàn bộ phần còn lại
- Không đặt `ConceptExplanationCard`, `ConceptQuizCard`, hay `ConceptMasteryCard` thành cột riêng nữa.
- `VoiceTutorDock` tiếp tục là dock nổi độc lập, không tham gia bố cục chính.

### 2. Main Lesson Structure

`ConceptLessonCard` sẽ được đổi từ một card dài đơn giản sang một lesson article kiểu reading page với cấu trúc ưu tiên:

1. Khái niệm cốt lõi
2. Các ý chính cần nhớ
3. Ví dụ minh họa
4. Feynman ngắn
5. CTA cuối bài / quiz

Điều này có nghĩa:

- Phần mở bài phải nói thẳng vào kiến thức cốt lõi, không dùng Feynman làm nội dung chính.
- Feynman chỉ là một block hỗ trợ ngắn, đặt gần cuối hoặc sau ví dụ minh họa.
- Nội dung lý thuyết và technical meaning phải chiếm nhiều diện tích hơn phần metaphor.
- Giải thích thêm không được chen vào luồng bài chính; nó phải là lớp phụ, mở theo nhu cầu.

### 3. Post-Lesson Flow

Sau `ConceptLessonCard`, các phần phụ trợ sẽ không còn nằm ở cột phải mà đi xuống dưới theo thứ tự:

1. `ConceptExplanationCard`
2. `ConceptQuizCard` hoặc `LockedQuizState`
3. `ConceptMasteryCard`

Quy tắc:

- `ConceptExplanationCard` là nhánh phụ đầu tiên vì đây là nơi người học tìm đến nếu chưa hiểu bài.
- `ConceptQuizCard` là bước tiếp theo ngay sau khi học xong hoặc sau khi đã xem giải thích lại.
- `ConceptMasteryCard` lùi xuống cuối như một kết quả học tập, không được chen ngang quá trình đọc và làm quiz.

## Visual Metaphor Strategy

### 1. If backend image is good

- Vẫn ưu tiên dùng `lesson.metaphorImage.imageUrl`.
- Bao ảnh trong khung minh họa có caption và nền phụ trợ để ảnh trông như một phần của bài học, không phải ảnh gắn thêm.

### 2. If backend image is missing or fails

- Thay fallback text-poster bằng một CSS illustration scene.
- Scene mặc định cho nội dung hiện tại sẽ mô phỏng “garage + blueprint + multiple cars”:
  - bảng thiết kế treo trên tường
  - sàn garage
  - 2-3 chiếc xe với màu khác nhau
  - nhãn nhỏ chỉ vào blueprint và xe
- Scene này không cần biết toàn bộ semantics của mọi khái niệm; nó là fallback học-tập đủ tốt cho các bài dùng ẩn dụ dạng vật thể/bản thiết kế.
- Nếu backend trả ảnh thật tốt thì scene không hiển thị.

### 3. Why this fallback

- Giải quyết ngay vấn đề UX mà không cần chờ pipeline tạo ảnh backend ổn định.
- Người học luôn có một hình dung vật lý cơ bản thay vì chỉ thấy text.
- Không làm thay đổi API hay contract dữ liệu.

## Supporting Cards

### 1. Mastery + re-explain

- Chuyển `ConceptMasteryCard` và `ConceptExplanationCard` xuống dưới bài học chính.
- Giảm độ nặng của các card này bằng visual hierarchy nhẹ hơn lesson chính.
- `ConceptExplanationCard` không được hiển thị explanation theo kiểu chat. Nó chỉ hiển thị:
  - bản ngắn gọn
  - 3 ý chính
  - nút mở phần đầy đủ nếu cần
- Explanation đầy đủ phải nằm trong vùng có chiều cao giới hạn hoặc sheet riêng, không làm toàn trang bị kéo dài vô hạn.

### 2. Quiz

- Khi quiz chưa mở, hiển thị trạng thái “locked until ready” gọn và ít gây nhiễu.
- Khi quiz đã mở, phần quiz có khung riêng rõ ràng và nằm ngay sau explanation trong flow dọc.
- Quiz phải là bước tiếp theo rõ ràng sau khi người học đi qua bài chính, không bị đẩy xuống quá xa bởi explanation phụ.
- Khi người học bấm mở quiz, màn hình phải cuộn hoặc focus tới block quiz ngay, không để người học phải tự tìm.

## Explanation Strategy

### 1. Main lesson vs extended explanation

- Main lesson là lớp học chính, đủ để hiểu khái niệm và chuẩn bị làm quiz.
- Extended explanation là lớp hỗ trợ, dùng khi người học chưa hiểu bài chính.
- Hai lớp này không được cạnh tranh cùng một cấp thị giác.

### 2. Extended explanation UI

- Mặc định chỉ hiển thị explanation summary và các ý chính.
- Phần explanation đầy đủ chỉ xuất hiện khi người học chủ động mở.
- Nội dung đầy đủ phải ở một trong các pattern sau:
  - accordion có chiều cao giới hạn
  - vùng scroll nội bộ
  - side sheet đọc sâu
- Ưu tiên pattern không làm bài chính bị dồn xuống.

### 3. Explanation content rules

- Văn phong phải là giải thích thuần, không dùng opening kiểu chat như “Chào bạn”.
- Không lặp lại nhiều câu có cùng nội dung.
- Nội dung phải đi thẳng vào giải thích khái niệm.

## Quiz Generation Strategy

### 1. Product Goal

Quiz trong Learning Workspace không nhằm kiểm tra khả năng nhớ nguyên văn bài học. Nó phải đo mức hiểu hiện tại của người học để:

- cập nhật mastery
- hỗ trợ recompute learning path
- quyết định bước học tiếp theo

Vì vậy, quiz phải ngắn, sắc, dễ chấm, dễ scan trên UI, và dùng được cho mọi concept trong learning path.

### 2. Generation Approach

- Dùng hướng `Hybrid`:
  - `LLM-first` để sinh quiz dựa trên concept hiện tại
  - `rule-based fallback` nếu output không đạt validation hoặc model lỗi
- Không dùng template cứng cho riêng một concept như `Class và Object`.
- Prompt phải là prompt khung tổng quát, còn nội dung câu hỏi thay đổi theo input concept.

### 3. Dynamic Question Count

- Không cố định cứng luôn là `3 câu`.
- Dùng `question_count_target` động trong khoảng `2-4 câu`.
- Quy tắc:
  - concept rất cơ bản hoặc chỉ có ít ý thật sự đáng hỏi: `2 câu`
  - concept thông thường: `3 câu`
  - concept nhiều góc nhìn, có distinction/application rõ: `4 câu`
- Mặc định mục tiêu là `3 câu`, nhưng backend có quyền giảm hoặc tăng trong khung `2-4`.

### 4. Input Contract For Quiz Prompt

Prompt generation cần nhận tối thiểu:

- `concept_name`
- `concept_description`
- `explanation_summary`
- `example_or_analogy`
- `missing_prerequisites`
- `learner_mastery`
- `difficulty_target`
- `question_count_target`
- `language = vi`

### 5. Question Types Supported

Quiz engine phải có khả năng sinh câu hỏi cho mọi concept theo các nhóm:

1. `definition`
2. `distinction`
3. `analogy`
4. `application`
5. `misconception`

Quy tắc chọn nhóm:

- Nếu concept thiên về định nghĩa: ưu tiên `definition`, `distinction`, `misconception`
- Nếu concept có ví dụ / ẩn dụ mạnh: thêm `analogy`
- Nếu concept mang tính quy trình / cơ chế: thêm `application`
- Nếu mastery thấp: thiên về câu trực tiếp, rõ ý, ít đánh đố
- Nếu mastery cao hơn: tăng `distinction` và `application`
- Nếu thiếu prerequisite: tránh hỏi điều phụ thuộc mạnh vào prerequisite chưa học

### 6. Question Quality Rules

Mỗi câu hỏi phải tuân thủ:

- chỉ kiểm tra `1 ý chính`
- có đúng `4 lựa chọn`
- chỉ có `1 đáp án đúng rõ ràng`
- option ngắn, lý tưởng `5-18 từ`
- không biến option thành đoạn văn
- không để 4 option là các paraphrase của cùng một ý
- không hỏi meta về “cách giải thích”
- không copy gần nguyên văn explanation

Distractor phải:

- sai nhưng có vẻ hợp lý với người chưa hiểu kỹ
- liên quan tới concept hiện tại
- đủ khác để phân biệt đúng/sai rõ
- không vô lý hoàn toàn
- không mơ hồ kiểu nhiều đáp án cùng đúng một phần quan trọng

### 7. Output Contract

Quiz output nội bộ nên có cấu trúc tối thiểu:

- `question`
- `options` (4 strings)
- `correct_answer`
- `explanation_short`
- `difficulty`
- `skill_tag`

Tất cả bằng tiếng Việt.

Nếu cần giữ contract UI hiện tại, backend có thể map từ artifact nội bộ này sang payload client hiện có, nhưng source artifact phải đủ giàu để phục vụ validation và grading explanation.

### 8. Validation Layer

Sau khi LLM sinh quiz, backend phải validate từng câu và toàn bộ bộ câu hỏi:

#### Per-question validation

- `Length check`
  - reject nếu option quá dài
  - reject nếu question quá dài không cần thiết
- `Similarity check`
  - reject nếu các option quá giống nhau về wording
- `Single-correctness check`
  - reject nếu output khiến hơn một option có vẻ đúng
- `Format check`
  - reject nếu thiếu `4 lựa chọn` hoặc thiếu `1 correct_answer`

#### Whole-quiz validation

- `Coverage check`
  - các câu không được hỏi trùng đúng một ý
  - bộ câu nên bao phủ ít nhất `2` góc nhìn khác nhau nếu `question_count_target >= 3`
- `UI-aware check`
  - option phải dễ scan trong dark theme
  - không tạo block text dài

Nếu fail validation:

- regenerate câu lỗi hoặc toàn bộ bộ câu hỏi
- nếu vẫn fail sau số lần retry giới hạn, rơi về `rule-based fallback`

### 9. Rule-Based Fallback

Fallback không nên hỏi kiểu “đâu là lời giải thích Feynman của bài này?” nữa.

Fallback mới cần:

- dựa trên `concept_description`, `technicalTranslation`, `imageMapping`, `prerequisiteMiniLessons`
- sinh các câu ngắn theo nhóm `definition`, `distinction`, `analogy`, `application`, `misconception`
- vẫn tuân thủ rule `4 options`, `1 correct answer`, option ngắn, không đọc lại nguyên văn bài học

### 10. Example Targets

Thiết kế này phải hoạt động ổn định cho nhiều loại concept, ví dụ:

- `Encapsulation`
- `Backpropagation`
- `Function` trong Python cơ bản

Nó không được ngầm giả định concept luôn là OOP hay luôn có metaphor giống nhau.

## Responsive Behavior

- Desktop lớn: 2 vùng `path | study flow`, trong đó study flow chiếm phần lớn chiều ngang.
- Tablet: path có thể giữ bên trái nếu còn chỗ; nếu không, lesson flow lên trước còn path xuống dưới.
- Mobile: lesson flow thành một cột duy nhất; path trở thành block gọn phía trên hoặc phía dưới.
- Trên mọi breakpoint, support sections phải đi theo flow dọc dưới bài học thay vì đứng thành cột riêng.

## Files To Change

- `packages/dashboard/src/features/learning-graph/pages/ConceptLearningPage.tsx`
- `packages/dashboard/src/features/learning-graph/components/ConceptLessonCard.tsx`
- `packages/dashboard/src/features/learning-graph/components/LearningPathPanel.tsx`
- `packages/dashboard/src/features/learning-graph/components/ConceptExplanationCard.tsx`
- `packages/dashboard/src/features/learning-graph/components/ConceptQuizCard.tsx`
- `packages/dashboard/src/features/learning-graph/components/ConceptMasteryCard.tsx`
- `backend/src/services/learning-graph/tutor.service.ts`
- `backend/src/services/learning-graph/session.service.ts`
- `backend/src/services/learning-graph/learning-orchestrator.service.ts`
- `packages/shared-schemas/src/learning-graph-api.schema.ts`
- `backend/src/infra/database/migrations/`
- Có thể thêm helper UI nhỏ cùng thư mục `components/` nếu cần để giữ file gọn.

## Testing And Validation

- Xác nhận layout desktop không còn ép phần lesson vào cột hẹp.
- Xác nhận desktop không còn `right rail` cố định.
- Xác nhận bài học chính chiếm gần như toàn bộ chiều ngang còn lại ngoài path.
- Xác nhận `Giải thích lại -> Quiz -> Mastery` xuất hiện theo flow dọc và dễ tìm.
- Xác nhận mobile/tablet không bị vỡ thứ bậc thông tin.
- Xác nhận fallback minh họa hiển thị đúng khi `imageUrl` lỗi hoặc rỗng.
- Xác nhận explanation không còn giọng chat hoặc các câu mở đầu dư thừa.
- Xác nhận explanation đã sinh được mở lại nhanh từ dữ liệu đã lưu, không phải tạo mới mỗi lần.
- Chạy `cd packages/dashboard && npm run typecheck`
- Chạy `cd packages/dashboard && npm run build`
- Chạy `cd frontend && npm run build` nếu có ảnh hưởng tới shell host.
- Chạy `cd backend && npm test`
- Chạy `cd backend && npm run build`
- Chạy `cd packages/shared-schemas && npm run build`

## Scope Guardrails

- Không thay đổi API backend hay schema lesson package.
- Không sửa logic voice tutor trong thay đổi này.
- Không thêm state manager mới; chỉ tái cấu trúc component và presentation.
