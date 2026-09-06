import { readChangelog } from "@/lib/changelog-store";
import { ActivityList } from "@/components/activity/activity-list";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const entries = readChangelog().slice(0, 200);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Activity</h1>
        <p className="text-sm text-muted-foreground">
          Every change is logged here. If something looks wrong, undo it — undoing
          writes a new entry rather than erasing history.
        </p>
      </div>
      <ActivityList initialEntries={entries} />
    </div>
  );
}
