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

- Giữ `LearningPathPanel` ở cột trái nhưng giảm vai trò thị giác, để nó làm navigation thay vì nội dung chính.
- Cột phải trở thành `learning workspace` rộng hơn, ưu tiên chiều ngang cho việc đọc bài.
- Trong workspace, sắp xếp nội dung theo thứ tự học tự nhiên:
  1. Header khái niệm và trạng thái học
  2. Bài học chính
  3. Khu vực luyện lại và mastery
  4. Quiz

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

- Gom `ConceptMasteryCard` và `ConceptExplanationCard` vào nhóm phụ trợ bên phải hoặc bên dưới tùy breakpoint.
- Giảm độ nặng của các card này bằng visual hierarchy nhẹ hơn lesson chính.
- `ConceptExplanationCard` không được hiển thị explanation theo kiểu chat. Nó chỉ hiển thị:
  - bản ngắn gọn
  - 3 ý chính
  - nút mở phần đầy đủ nếu cần
- Explanation đầy đủ phải nằm trong vùng có chiều cao giới hạn hoặc sheet riêng, không làm toàn trang bị kéo dài vô hạn.

### 2. Quiz

- Khi quiz chưa mở, hiển thị trạng thái “locked until ready” gọn và ít gây nhiễu.
- Khi quiz đã mở, phần quiz có khung riêng rõ ràng nhưng vẫn đứng sau lesson trong hierarchy.
- Quiz phải là bước tiếp theo rõ ràng sau khi người học đi qua bài chính, không bị đẩy xuống quá xa bởi explanation phụ.

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

## Responsive Behavior

- Desktop lớn: 3 vùng nhẹ `path | lesson article | support rail`, trong đó lesson article là vùng lớn nhất.
- Tablet: lesson article lên trước, path và support xuống dưới.
- Mobile: lesson flow thành một cột duy nhất; explanation đầy đủ phải dùng vùng mở rộng có kiểm soát chiều cao hoặc full-screen sheet.

## Files To Change

- `packages/dashboard/src/features/learning-graph/pages/ConceptLearningPage.tsx`
- `packages/dashboard/src/features/learning-graph/components/ConceptLessonCard.tsx`
- `packages/dashboard/src/features/learning-graph/components/LearningPathPanel.tsx`
- `packages/dashboard/src/features/learning-graph/components/ConceptExplanationCard.tsx`
- `packages/dashboard/src/features/learning-graph/components/ConceptQuizCard.tsx`
- `backend/src/services/learning-graph/tutor.service.ts`
- `backend/src/services/learning-graph/session.service.ts`
- `backend/src/services/learning-graph/learning-orchestrator.service.ts`
- `packages/shared-schemas/src/learning-graph-api.schema.ts`
- `backend/src/infra/database/migrations/`
- Có thể thêm helper UI nhỏ cùng thư mục `components/` nếu cần để giữ file gọn.

## Testing And Validation

- Xác nhận layout desktop không còn ép phần lesson vào cột hẹp.
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
