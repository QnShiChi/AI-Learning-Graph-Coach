Ok, mình sẽ viết cho bạn một **SPEC kỹ thuật chuẩn (MVP → research-ready)** để bạn có thể **bắt đầu code ngay với InsForge** + dùng được cho paper sau này.

# 📄 AI Learning Graph Coach - Technical Spec (v1.0)

# 1\. 🎯 Scope (MVP)

### Mục tiêu

Xây hệ thống có thể:

- Nhận input learning goal / tài liệu
- Tự build **Knowledge Graph (KG)**
- Generate **learning path cá nhân hóa**
- Có **AI tutor + quiz + mastery tracking**

# 2\. 🏗️ System Architecture

## 2.1 High-level

Client (React)

↓

InsForge Backend

├── PostgreSQL (Graph + User State)

├── Edge Functions (AI pipeline)

├── Storage (PDF, docs)

├── Realtime (WebSocket)

└── Auth (JWT)

## 2.2 Service breakdown

| Service            | Responsibility               |
| ------------------ | ---------------------------- |
| Graph Service      | quản lý concept + edge       |
| AI Service         | extract, prerequisite, tutor |
| Learning Engine    | path + recommendation        |
| Assessment Service | quiz + mastery               |
| Realtime Service   | sync dashboard               |

# 3\. 🧩 Database Schema (PostgreSQL)

## 3.1 concepts

CREATE TABLE concepts (

id UUID PRIMARY KEY,

name TEXT,

description TEXT,

difficulty FLOAT,

embedding VECTOR(768),

domain TEXT,

created_at TIMESTAMP

);

## 3.2 edges (prerequisite graph)

CREATE TABLE edges (

id UUID PRIMARY KEY,

from_concept UUID,

to_concept UUID,

weight FLOAT,

type TEXT DEFAULT 'prerequisite',

created_at TIMESTAMP

);

## 3.3 users

CREATE TABLE users (

id UUID PRIMARY KEY,

email TEXT,

created_at TIMESTAMP

);

## 3.4 user_concept_state

CREATE TABLE user_concept_state (

user_id UUID,

concept_id UUID,

mastery FLOAT,

confidence FLOAT,

last_updated TIMESTAMP,

PRIMARY KEY (user_id, concept_id)

);

## 3.5 learning_paths

CREATE TABLE learning_paths (

id UUID PRIMARY KEY,

user_id UUID,

target_concept UUID,

path JSONB,

created_at TIMESTAMP

);

## 3.6 quizzes

CREATE TABLE quizzes (

id UUID PRIMARY KEY,

concept_id UUID,

question TEXT,

options JSONB,

answer TEXT,

difficulty FLOAT

);

# 4\. 🤖 AI Pipeline

## 4.1 Concept Extraction

### Input

- text / PDF / topic

### Output

\[

{"name": "Gradient Descent"},

{"name": "Chain Rule"},

{"name": "Backpropagation"}

\]

### Prompt (core)

Extract key learning concepts from the following content.

Return a flat list of concepts (no explanation).

## 4.2 Prerequisite Prediction

### Input

{

"concept_a": "Linear Algebra",

"concept_b": "Backpropagation"

}

### Output

{

"is_prerequisite": true,

"confidence": 0.87

}

### MVP

- dùng LLM zero-shot

### Research upgrade

- GNN + embedding + LLM hybrid

## 4.3 Explanation Engine (Tutor)

### Input

{

"concept": "Backpropagation",

"user_mastery": 0.3,

"missing_prerequisites": \["Linear Algebra"\]

}

### Behavior

- nếu thiếu prerequisite → explain đơn giản
- nếu mastery cao → explain sâu

## 4.4 Quiz Generation

Generate 3 multiple-choice questions for the concept.

Include difficulty and correct answer.

# 5\. 🧠 Learning Engine

## 5.1 Path Generation

### Objective

Tìm next concept tối ưu

score = (1 - mastery) \* difficulty + prerequisite_gap

## 5.2 Recommendation

next_concept = argmin(score)

# 6\. 📡 API Design (Edge Functions)

## 6.1 Create Graph

POST /graph/build

### Body

{

"input": "Deep Learning"

}

## 6.2 Get Learning Path

GET /learning-path/:user_id/:target

## 6.3 Tutor

POST /tutor/explain

## 6.4 Generate Quiz

POST /quiz/generate

## 6.5 Submit Quiz

POST /quiz/submit

# 7\. ⚡ Realtime Events

## Channels

### learning_progress

{

"user_id": "...",

"concept": "...",

"mastery": 0.75

}

### classroom_dashboard

{

"concept": "Backpropagation",

"avg_mastery": 0.42

}

# 8\. 🖥️ Frontend (React)

## Pages

### 1\. Dashboard

- learning path
- progress graph

### 2\. Concept View

- explanation
- prerequisite tree

### 3\. Quiz View

- questions
- result

### 4\. Graph View (🔥 killer feature)

- visualize knowledge graph

# 9\. 🔁 Learning Loop

Input → Graph → Path → Learn → Quiz → Update Mastery → Adjust Path

# 10\. 🧪 Metrics (cho research)

- learning gain
- time-to-mastery
- prerequisite accuracy
- path optimality

# 11\. 🚀 Scaling (future)

- multi-domain graph
- cross-user collaborative graph
- fine-tuned prerequisite model
- offline RL for path optimization

# 12\. 🔥 MVP Definition (DONE khi có)

Bạn hoàn thành MVP nếu:

✅ nhập topic → sinh graph  
✅ có path  
✅ có quiz  
✅ update mastery  
✅ UI hiển thị graph

# 👉 Next step (rất quan trọng)

Nếu bạn muốn build thật:

👉 nói mình:

- "viết SQL migration + seed data"
- hoặc "viết code edge function (InsForge)"
- hoặc "thiết kế prompt tối ưu cho prerequisite"

Mình sẽ giúp bạn đi tiếp **từng bước tới production / paper luôn**.