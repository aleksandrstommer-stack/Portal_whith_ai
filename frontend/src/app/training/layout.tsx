import { TrainingSidebar } from "@/components/training-sidebar";
import { fetchTrainingCourses } from "@/lib/queries";

export default async function TrainingLayout({ children }: { children: React.ReactNode }) {
  const courses = await fetchTrainingCourses();

  return (
    <div className="container py-10">
      <div className="grid gap-8 lg:grid-cols-[280px_1fr] lg:items-start">
        <TrainingSidebar courses={courses.data} />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
