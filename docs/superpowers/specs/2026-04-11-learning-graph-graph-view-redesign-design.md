# Learning Graph Graph View Redesign Design

## Goal

Redesign `Graph View / Đồ thị kiến thức` từ layout dạng hai danh sách thành một knowledge map thật sự, giúp người học nhìn vào là hiểu ngay:

- mình đang ở concept nào
- mình đã đi qua đâu
- concept tiếp theo là gì
- concept nào còn bị khóa
- vì sao một concept đang bị khóa
- đường học đề xuất hiện tại đi qua những node nào

Graph View vẫn là một `visualization/read model phụ`, không thay thế `Overview` hoặc `Learn` làm điều hướng chính.

## Problems In Current UI

- `KnowledgeGraphPanel` hiện tại render `concepts` và `edges` thành hai danh sách text rời.
- Người dùng thấy dữ liệu nhưng không thấy cấu trúc graph.
- Không có cảm giác định vị không gian cho current concept trong toàn bộ hành trình học.
- Không có distinction thị giác đủ mạnh giữa `completed`, `current`, `next`, `upcoming`, và `locked`.
- `difficulty` đang hiển thị thành text khô, chưa hỗ trợ đọc nhanh.
- Màn hình không tạo được cảm giác “knowledge map”, nên chưa đủ sức làm một killer feature.
- Vùng canvas hiện tại chưa đủ rộng; detail panel luôn mở làm graph mất diện tích overview.
- Layout node hiện tại dùng spacing cố định đơn giản nên các node nhiều nhánh dễ bị dính cụm, khó đọc.
- Graph View hiện chưa support light/dark theme đúng nghĩa; canvas và node styling đang nghiêng về dark-only.

## Product Constraints

- Graph View chỉ đóng vai trò giải thích prerequisite và learning path, không phải điều hướng chính.
- Click node chỉ chọn node và mở panel chi tiết.
- Điều hướng sang concept khác chỉ đi qua CTA `Đi tới bài học này` trong detail panel.
- Dữ liệu render phải bám vào source of truth hiện tại:
  - `graph.concepts`
  - `graph.edges`
  - `pathSnapshot`
  - `currentConcept`
  - `session.currentConceptId`
- Không thay đổi backend schema hay API contract cho feature này.

## Recommended Approach

Chọn hướng `canonical knowledge map`:

- Canvas graph lớn ở trung tâm màn hình
- Mỗi concept là một node
- Mỗi prerequisite relation là một directed edge
- Node được xếp theo level prerequisite từ trái sang phải
- Recommended path được highlight như lớp dẫn đường phủ lên topology thật của graph

Lý do chọn hướng này:

- Trung thực nhất với mental model của knowledge graph
- Giải thích được cả dependency thật và luồng học đề xuất
- Cho phép tạo cảm giác “wow” bằng node states, canvas hierarchy, path highlight, và motion nhẹ thay vì dựa vào card dashboard

## Proposed Layout

### 1. Page Shell

`KnowledgeGraphPage` mới gồm ba vùng:

1. Header gọn ở trên
2. Graph canvas chiếm phần lớn màn hình
3. Detail panel ở cạnh phải trên desktop, chuyển thành drawer/sheet trên màn hình hẹp

Trong desktop, canvas phải là vùng ưu tiên tuyệt đối về diện tích. Detail panel không được mặc định chiếm chỗ lớn khi người dùng chưa chọn node.

### 2. Header

Header chỉ giữ các thành phần sau:

- tên session hoặc `session.goalTitle`
- tổng quan tiến độ `completed/total`
- nút `Về tổng quan`
- toggle chế độ:
  - `Toàn bộ graph`
  - `Chỉ đường học đề xuất`

Header phải gọn, không thêm card tổng quan lớn để tránh cạnh tranh với canvas.

### 3. Canvas

Canvas là trung tâm thị giác của trang:

- hỗ trợ cả light theme lẫn dark theme bằng token riêng cho graph
- nền có dot matrix hoặc grid rất nhẹ, thay đổi theo theme
- graph đi từ trái sang phải
- level prerequisite ở bên trái, các concept phức tạp hơn đi sang phải
- current node là tâm điểm chính
- recommended path sáng hơn các cạnh còn lại
- legend nhỏ nằm nổi trong canvas, không chiếm nhiều diện tích
- canvas phải cao và rộng hơn hiện tại để người dùng nhìn được tổng quan graph nhiều nhánh
- không khóa cứng ở chiều cao nhỏ kiểu `620px`; ưu tiên vùng nhìn gần `72vh`

### 4. Detail Panel

Trên desktop, panel mặc định ở trạng thái `collapsed rail`:

- chỉ còn một rail mảnh hoặc trigger `Chi tiết`
- graph chiếm gần như toàn bộ chiều ngang

Khi chưa chọn node và panel đang mở, panel hiển thị:

- legend 5 trạng thái
- giải thích hai lớp line:
  - line thường = prerequisite
  - line sáng = đường học đề xuất
- summary nhỏ:
  - `Bạn đang học`
  - `Bước tiếp theo`
  - `Đã hoàn thành x / y`

Khi chọn node, panel hiển thị:

- tên concept
- mô tả ngắn
- trạng thái hiện tại
- difficulty trực quan
- mastery nếu có
- prerequisite trực tiếp
- nếu node bị khóa: danh sách prerequisite còn thiếu
- CTA `Đi tới bài học này`

Quy tắc mở/đóng panel:

- mặc định không chọn node: panel nên ở trạng thái thu gọn để ưu tiên canvas
- chọn node: panel trượt ra từ cạnh phải
- đóng panel: canvas giãn lại nhưng không reset pan/zoom của graph
- mobile/tablet: panel chuyển thành bottom sheet thay vì cạnh phải cố định

## Visual State Model

### 1. Node States

Node state được map từ `pathSnapshot` và `session.currentConceptId`.

- `completed`
  - `pathSnapshot.pathState === 'completed'`
  - node fill đậm
  - icon check
- `current`
  - `pathSnapshot.pathState === 'current'` hoặc `concept.id === session.currentConceptId`
  - node lớn hơn các node khác
  - glow/halo rõ
  - badge `Đang học`
- `next`
  - `pathSnapshot.pathState === 'next'`
  - viền sáng hơn
  - badge `Tiếp theo`
- `upcoming`
  - `pathSnapshot.pathState === 'upcoming'`
  - trạng thái bình thường
- `locked`
  - `pathSnapshot.pathState === 'locked'`
  - node mờ đi
  - khi chọn node phải giải thích prerequisite còn thiếu
- `untracked`
  - concept có trong graph nhưng chưa có item trong `pathSnapshot`
  - render gần với `upcoming` nhưng giảm nhấn thêm một nấc

`selected` là trạng thái bổ sung, không thay thế state gốc. Nó chỉ tăng outline/panel sync.

### 2. Difficulty And Mastery

`difficulty` không hiển thị như text chính trên node.

Thay vào đó:

- difficulty dùng outer ring hoặc segmented arc quanh node
- mastery chỉ nhấn mạnh ở current node và detail panel

Nguyên tắc:

- `pathSnapshot` là source of truth cho tiến trình học
- `masteryScore` là dữ liệu hỗ trợ để giải thích mức nắm vững, không quyết định trực tiếp việc node có hiển thị completed hay không

### 3. Locked Explanation

Với node `locked`, panel phải giải thích ngắn:

- `Cần hoàn thành trước`
- liệt kê direct prerequisite chưa completed

Logic:

- lấy incoming prerequisite edges của node
- đối chiếu với `pathSnapshot`
- chỉ hiển thị các prerequisite chưa ở trạng thái `completed`

## Recommended Path Model

Recommended path không thay thế prerequisite graph. Đây là lớp highlight độc lập.

Nguồn dựng path:

- `pathSnapshot` theo `position`

Từ đó dựng:

- `pathConceptIds`
- `pathEdges` nhân tạo nối `position n -> position n+1`

Ý nghĩa:

- prerequisite edges trả lời `vì sao concept này phụ thuộc concept khác`
- path edges trả lời `luồng học đề xuất hiện tại đi qua đâu`

Trong chế độ `Toàn bộ graph`:

- render toàn bộ nodes + prerequisite edges
- path edges được highlight nổi hơn

Trong chế độ `Chỉ đường học đề xuất`:

- chỉ render nodes có trong `pathSnapshot`
- chỉ render path edges
- bỏ phần topology phụ ngoài path để người dùng nhìn được luồng chính nhanh hơn

## Interaction Model

### 1. Node Click

- click node chỉ chọn node
- không điều hướng ngay
- panel bên phải cập nhật theo node được chọn và bung ra nếu đang thu gọn

Quy tắc này giữ Graph View là visualization phụ, không biến canvas thành điều hướng chính.

### 2. Hover

Hover node nên:

- tăng highlight tinh tế cho node
- highlight incoming/outgoing edges liên quan
- với locked node, gợi ý ngắn rằng node đang bị khóa

### 3. Panel And Viewport Behavior

- mở panel không được làm `fitView` chạy lại quá mạnh
- nếu selected node đang ở quá sát mép canvas, cho phép recenter nhẹ node đó
- đóng panel không làm người dùng mất vị trí pan/zoom hiện tại

### 4. Primary Action

Chỉ có một CTA điều hướng:

- `Đi tới bài học này`

CTA này nằm trong detail panel, không đặt trực tiếp trên từng node.

## Rendering Strategy

### 1. Graph Engine

Sử dụng `@xyflow/react` vì package dashboard đã có sẵn dependency và đã dùng trong visualizer.

Lý do:

- hỗ trợ pan/zoom/fitView
- dễ tạo custom node và custom edge
- không cần tự xây graph canvas từ đầu
- nhất quán với pattern visualization đã có trong codebase

### 2. Layout Strategy

Layout node theo DAG layering:

- node không có prerequisite ở `level 0`
- node còn lại có `level = max(level(prerequisite)) + 1`

Sau đó áp dụng ba bước layout:

1. `Layering`
2. `In-column ordering`
3. `Collision resolution`

Trong mỗi level:

- ưu tiên sort theo `pathSnapshot.position` nếu concept nằm trong recommended path
- ưu tiên đặt các node thuộc path chính gần trục giữa của graph
- node có nhiều outgoing edges hơn nên nằm gần tâm cột để các nhánh dễ xòe ra
- phần còn lại sort ổn định theo tên hoặc id để layout ít nhảy

Sau khi có vị trí sơ bộ:

- chạy collision pass theo từng cột
- nếu hai node cùng cột chồng lên nhau hoặc quá sát nhau theo trục dọc, đẩy node dưới xuống
- sau khi dồn node, recenter lại cột để toàn cột không bị lệch hẳn lên trên hoặc xuống dưới
- spacing phải dựa trên chiều cao node thực tế thay vì chỉ một hằng số duy nhất

Mục tiêu của layout:

- path chính đi mượt từ trái sang phải
- prerequisite branches vẫn dễ đọc
- current node nằm gần trung tâm vùng nhìn sau khi `fitView`
- node không dính cục nhau trong graph nhiều nhánh
- nhánh phụ xòe rõ hơn, không bị dồn thành một cụm nhỏ

### 3. Edge Strategy

- prerequisite edge:
  - mảnh
  - muted
  - có arrowhead nhỏ
- path edge:
  - dày hơn
  - sáng hơn
  - nằm trên prerequisite edges
- edge tới locked node:
  - giảm opacity
- hover node:
  - chỉ nhấn mạnh các edge liên quan node đó
- edge routing nên cong vừa phải để giảm cảm giác “búi dây” khi graph nhiều nhánh

### 4. Canvas Sizing And Viewport

- bỏ chiều cao cố định nhỏ
- desktop dùng canvas cao khoảng `72vh` hoặc lớn hơn khi không có panel mở
- tăng canvas padding nội bộ để fitView có vùng thở
- khi panel thu gọn, canvas gần full width
- khi panel mở, canvas vẫn phải là phần tử chiếm ưu thế về diện tích

### 5. Theme Strategy

Graph View phải support light/dark theme bằng một bộ token riêng thay vì hardcode dark styling.

Tối thiểu cần token cho:

- `canvasBg`
- `canvasGlow`
- `dotColor`
- `legendBg`
- `panelBg`
- `nodeBorder`
- `nodeSurface`
- `edgePrerequisite`
- `edgePath`
- `edgeMuted`
- `currentGlow`
- `textPrimary`
- `textMuted`

Nguyên tắc:

- dark mode giữ chiều sâu, glow nhẹ, độ tương phản rõ
- light mode dùng nền sáng và edge trung tính, tránh cảm giác “dark UI ép sang light”
- current node phải nổi bật ở cả hai theme, nhưng không được phụ thuộc vào neon glow

### 6. Motion

Motion cần nhẹ và có mục đích:

- canvas fade-in nhẹ
- path highlight xuất hiện mượt lúc load
- current node pulse chậm
- hover node tăng shadow/ring trong 120-180ms

Phải tôn trọng `prefers-reduced-motion`.

## Component Structure

### 1. Page And Containers

- `KnowledgeGraphPage`
- `KnowledgeGraphHeader`
- `KnowledgeGraphCanvas`
- `KnowledgeGraphDetailPanel`

### 2. Graph Rendering

- `KnowledgeGraphNode`
- `KnowledgeGraphPrerequisiteEdge`
- `KnowledgeGraphPathEdge`

### 3. View Model

Thêm lớp transform riêng, ví dụ:

- `knowledge-graph-view-model.ts`

Trách nhiệm:

- map `graph + pathSnapshot + currentConcept` thành render model
- tính `nodeState`
- tính `level`
- dựng `pathEdges`
- tính locked reasons
- cung cấp summary data cho panel

Lý do cần lớp này:

- tránh để `KnowledgeGraphPage` ôm cả logic layout lẫn logic UI
- dễ test mapping logic độc lập
- dễ mở rộng khi path state hoặc detail panel thay đổi

## Loading, Empty, And Error States

### 1. Loading

Không dùng skeleton dạng list.

Thay vào đó:

- giữ nguyên shell của page
- render graph canvas skeleton với một số ghost node và ghost edges

Mục tiêu là cho người dùng cảm giác “graph đang được dựng”, không phải “danh sách đang tải”.

### 2. Empty

Nếu không có concept:

- hiển thị message ngắn giải thích session chưa có graph
- CTA quay về overview

Nếu có concept nhưng chưa có edge:

- vẫn render node layout tối giản
- panel nêu rõ chưa có prerequisite relation

### 3. Error

Error state cần nằm trong canvas shell thay vì bật ra một card lạc bố cục.

Page vẫn giữ:

- header
- panel shell
- vùng canvas hiển thị thông báo lỗi và CTA quay lại hoặc thử tải lại

## Responsive Behavior

### 1. Desktop

- canvas là vùng ưu tiên tuyệt đối
- panel mặc định thu gọn
- khi chọn node thì panel mới trượt ra
- nếu không chọn node, graph nên gần full width

### 2. Tablet And Mobile

- canvas vẫn là vùng chính
- detail panel chuyển thành bottom drawer hoặc sheet
- giảm bớt chrome không cần thiết
- chỉ giữ controls thật sự hữu ích như `fit view` hoặc zoom nếu cần

## Why This Is More Intuitive

Thiết kế mới trực quan hơn vì:

- topology thật của knowledge graph được thể hiện bằng node và edge thay vì text list
- current concept có vị trí thị giác rõ ràng trong toàn bộ hành trình
- completed/next/locked được phân tầng bằng visual hierarchy thay vì chỉ bằng chữ
- recommended path trở thành một route dễ theo dõi
- locked state có lời giải thích cụ thể thay vì chỉ là trạng thái mờ không rõ lý do
- detail panel giúp giải thích context mà không làm canvas mất vai trò trung tâm
- graph có nhiều diện tích hơn để người dùng đọc overview trước khi đi vào detail
- node spacing tốt hơn giúp graph nhiều nhánh không còn cảm giác dính cục hoặc nghẹt thở
- light/dark theme đúng nghĩa giúp màn hình hòa vào toàn bộ dashboard thay vì chỉ đẹp ở dark mode

## Implementation Scope

### In Scope

- thay `KnowledgeGraphPanel` list-based bằng canvas node-based
- thêm mode toggle `Toàn bộ graph / Chỉ đường học đề xuất`
- thêm custom node states và edge states
- thêm detail panel
- thêm view-model transform layer cho graph page
- thêm loading/empty/error states mới phù hợp với canvas
- đổi panel desktop sang kiểu mặc định thu gọn rồi mới bung ra khi chọn node
- tăng diện tích canvas và bỏ chiều cao cố định nhỏ
- thêm anti-overlap layout pass cho node spacing
- thêm theme-aware graph tokens cho light/dark mode

### Out Of Scope

- thay đổi backend schema hoặc API response
- biến Graph View thành điều hướng chính
- thay đổi flow học chính ở `Overview` hoặc `ConceptLearningPage`
- thêm editing capability cho graph
- thêm multi-select, drag-to-edit, hoặc graph authoring

## Success Criteria

Người dùng nhìn vào Graph View mới trong vài giây phải trả lời được:

- tôi đang ở đâu
- tôi đã học xong gì
- tôi nên học gì tiếp
- concept nào đang bị khóa
- vì sao nó bị khóa
- đường học đề xuất hiện tại đi qua đâu

Implementation được coi là đạt nếu:

- vẫn bám vào source of truth hiện tại của session/path
- current concept và recommended path luôn được highlight rõ
- light và dark theme đều dễ đọc
- desktop là trải nghiệm chính nhưng tablet/mobile không vỡ
- visual hierarchy tập trung vào graph canvas, không quay về card dashboard/list layout
- node không còn dính nhau trong các graph có nhiều nhánh
- panel không làm mất overview khi người dùng chưa chọn node
