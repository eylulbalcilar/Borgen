"use client";

import { ActivityFeed } from "@/components/activity-feed";

export function ActivitySection() {
  return (
    <section aria-labelledby="activity-heading" className="flex flex-col gap-2">
      <h2 id="activity-heading" className="text-lg font-medium">
        Activity
      </h2>
      <ActivityFeed />
    </section>
  );
}
