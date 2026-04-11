# Learning Graph Concept Learning Study Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuyển màn hình Learn của mỗi concept sang bố cục `Study Flow`: path hẹp bên trái, bài học chiếm toàn bộ phần còn lại, và toàn bộ support sections đi xuống dưới bài học thay vì đứng thành cột phải.

**Architecture:** Giữ nguyên route, query flow, và các component support hiện có, nhưng đổi `ConceptLearningPage` từ layout `3 cột` sang `2 cột`. `ConceptLessonCard` tiếp tục là vùng đọc chính; `ConceptExplanationCard`, `ConceptQuizCard`, và `ConceptMasteryCard` được dời xuống dưới bài học theo flow dọc để người học luôn nhìn thấy đúng bước tiếp theo mà không bị `right rail` chen thị giác.

**Tech Stack:** React, TypeScript, TanStack Query, Tailwind utility classes, shared dashboard components

---

## File Structure

- Modify: `packages/dashboard/src/features/learning-graph/pages/ConceptLearningPage.tsx`
  Responsibility: bỏ `right rail`, tạo layout `path + study flow`, đặt explanation/quiz/mastery xuống dưới bài học, và giữ auto-scroll tới quiz sau khi mở.
- Modify: `packages/dashboard/src/features/learning-graph/components/LearningPathPanel.tsx`
  Responsibility: làm path gọn hơn để đúng vai trò navigation phụ trong bố cục mới.
- Modify: `packages/dashboard/src/features/learning-graph/components/ConceptExplanationCard.tsx`
  Responsibility: đổi card này sang section hỗ trợ theo flow dọc dưới bài học, giảm cảm giác “sidebar widget”.
- Modify: `packages/dashboard/src/features/learning-graph/components/ConceptQuizCard.tsx`
  Responsibility: làm quiz phù hợp với vị trí mới ở trong flow chính, không còn bị thiết kế như một card sidebar.
- Modify: `packages/dashboard/src/features/learning-graph/components/ConceptMasteryCard.tsx`
  Responsibility: biến mastery thành summary block nhẹ ở cuối flow, thay vì panel cạnh tranh với bài học.

## Task 1: Chuyển trang Learn sang bố cục `2 cột + study flow`

**Files:**
- Modify: `packages/dashboard/src/features/learning-graph/pages/ConceptLearningPage.tsx`
- Test: `packages/dashboard/src/features/learning-graph/pages/ConceptLearningPage.tsx`

- [ ] **Step 1: Viết thay đổi bố cục desktop để bỏ `right rail`**

```tsx
<div className="hidden xl:grid xl:grid-cols-[220px_minmax(0,1fr)] xl:items-start xl:gap-8 2xl:grid-cols-[240px_minmax(0,1fr)]">
  <aside className="sticky top-6 self-start">
    {learningPathPanel}
  </aside>

  <main className="min-w-0 space-y-8">
    {lessonWorkspace}
    {studyFlowSections}
  </main>
</div>
```

- [ ] **Step 2: Gộp explanation, quiz, mastery thành một khối `studyFlowSections`**

```tsx
const studyFlowSections = conceptLearning ? (
  <div className="space-y-8">
    <section>
      <ConceptExplanationCard
        explanation={explanation}
        prerequisites={conceptLearning.prerequisites.map((item) => item.displayName)}
        onGenerate={generateExplanation}
        isLoading={isGeneratingExplanation}
      />
    </section>

    <section ref={quizSectionRef}>
      {conceptLearning.quiz ? (
        <ConceptQuizCard
          quiz={conceptLearning.quiz}
          onSubmit={submitQuiz}
          isSubmitting={isSubmittingQuiz}
          recapSummary={conceptLearning.recap?.summary ?? null}
        />
      ) : (
        <LockedQuizState />
      )}
    </section>

    <section>
      <ConceptMasteryCard
        masteryScore={conceptLearning.mastery?.masteryScore ?? 0}
        attemptCount={conceptLearning.mastery?.attemptCount ?? 0}
      />
    </section>
  </div>
) : null;
```

- [ ] **Step 3: Cập nhật tablet/mobile để lesson lên trước, support đi sau**

```tsx
<div className="space-y-6 xl:hidden">
  <section>{lessonWorkspace}</section>
  <section>{studyFlowSections}</section>
  <section>{learningPathPanel}</section>
</div>
```

- [ ] **Step 4: Giữ auto-scroll tới quiz sau khi mở**

```tsx
useEffect(() => {
  if (!shouldScrollToQuiz || !conceptLearning?.quiz) return;

  const timer = window.setTimeout(() => {
    quizSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setShouldScrollToQuiz(false);
  }, 120);

  return () => window.clearTimeout(timer);
}, [conceptLearning?.quiz, shouldScrollToQuiz]);
```

- [ ] **Step 5: Chạy typecheck để xác nhận layout mới không vỡ props**

Run: `cd packages/dashboard && npm run typecheck`
Expected: PASS

- [ ] **Step 6: Commit thay đổi layout cấp trang**

```bash
git add packages/dashboard/src/features/learning-graph/pages/ConceptLearningPage.tsx
git commit -m "refactor: move learning support below lesson flow"
```

## Task 2: Làm `LearningPathPanel` nhẹ hơn để chỉ còn vai trò navigation

**Files:**
- Modify: `packages/dashboard/src/features/learning-graph/components/LearningPathPanel.tsx`

- [ ] **Step 1: Thu gọn panel path để bớt nặng thị giác**

```tsx
<section className="rounded-[20px] border border-[var(--alpha-8)] bg-card/80 p-4">
  <div className="space-y-1">
    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
      Learning path
    </p>
    <h2 className="text-lg font-medium text-foreground">Lộ trình học</h2>
  </div>
```

- [ ] **Step 2: Làm mỗi item mảnh hơn và giảm badge prominence**

```tsx
<button
  type="button"
  onClick={() => onSelect(item.conceptId)}
  className="flex items-center justify-between rounded-xl border border-[var(--alpha-8)] bg-[var(--alpha-2)] px-3 py-2.5 text-left"
>
  <div className="min-w-0">
    <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
      Bước {index + 1}
    </p>
    <p className="truncate text-sm font-medium text-foreground">{item.label}</p>
  </div>
  <span className="rounded-full border border-[var(--alpha-8)] px-2 py-1 text-[11px] text-muted-foreground">
    {pathStateLabels[item.pathState]}
  </span>
</button>
```

- [ ] **Step 3: Chạy typecheck**

Run: `cd packages/dashboard && npm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit thay đổi path panel**

```bash
git add packages/dashboard/src/features/learning-graph/components/LearningPathPanel.tsx
git commit -m "style: slim down learning path navigation"
```

## Task 3: Đổi support cards sang section trong flow dọc

**Files:**
- Modify: `packages/dashboard/src/features/learning-graph/components/ConceptExplanationCard.tsx`
- Modify: `packages/dashboard/src/features/learning-graph/components/ConceptQuizCard.tsx`
- Modify: `packages/dashboard/src/features/learning-graph/components/ConceptMasteryCard.tsx`

- [ ] **Step 1: Đổi `ConceptExplanationCard` sang kiểu section hỗ trợ sau bài học**

```tsx
<section className="rounded-[24px] border border-[var(--alpha-8)] bg-card p-5">
  <div className="flex items-start justify-between gap-3">
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Giải thích thêm
      </p>
      <h2 className="text-xl font-medium text-foreground">Xem lại theo cách khác</h2>
    </div>
    <Button type="button" variant="outline" onClick={() => void props.onGenerate()}>
      {props.isLoading ? 'Đang tạo...' : 'Giải thích lại'}
    </Button>
  </div>
```

- [ ] **Step 2: Đổi `ConceptQuizCard` sang section nằm ngay sau explanation**

```tsx
<section className="rounded-[24px] border border-[var(--alpha-8)] bg-card p-5">
  <div className="space-y-2">
    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
      Tự kiểm tra
    </p>
    <h2 className="text-xl font-medium text-foreground">Bài kiểm tra ngắn</h2>
  </div>
```

- [ ] **Step 3: Đổi `ConceptMasteryCard` sang summary block nhẹ ở cuối**

```tsx
<section className="rounded-[20px] border border-[var(--alpha-8)] bg-[var(--alpha-2)] px-5 py-4">
  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
    Mastery hiện tại
  </p>
  <div className="mt-3 flex items-end gap-3">
    <span className="text-4xl font-semibold text-foreground">{Math.round(masteryScore * 100)}%</span>
    <span className="text-sm text-muted-foreground">{attemptCount} lần quiz</span>
  </div>
</section>
```

- [ ] **Step 4: Chạy typecheck**

Run: `cd packages/dashboard && npm run typecheck`
Expected: PASS

- [ ] **Step 5: Chạy frontend build để kiểm tra bundle thật**

Run: `cd frontend && npm run build`
Expected: PASS (warning cũ về `outDir`/chunk size có thể vẫn còn)

- [ ] **Step 6: Commit thay đổi support sections**

```bash
git add packages/dashboard/src/features/learning-graph/components/ConceptExplanationCard.tsx packages/dashboard/src/features/learning-graph/components/ConceptQuizCard.tsx packages/dashboard/src/features/learning-graph/components/ConceptMasteryCard.tsx
git commit -m "refactor: convert learning support into study flow sections"
```

## Self-Review

- Spec coverage: Plan này bao trọn các yêu cầu mới đã chốt trong spec: bỏ `right rail`, chuyển sang `2 cột`, bài học chiếm toàn bộ phần còn lại, support sections đi xuống dưới theo flow `Giải thích lại -> Quiz -> Mastery`.
- Placeholder scan: Không dùng `TBD`, `TODO`, hay bước mơ hồ; mỗi task có file, code, command, expected outcome.
- Type consistency: Tên component và props bám đúng codebase hiện tại: `ConceptLearningPage`, `LearningPathPanel`, `ConceptExplanationCard`, `ConceptQuizCard`, `ConceptMasteryCard`, `quizSectionRef`, `handleRevealQuiz`.

