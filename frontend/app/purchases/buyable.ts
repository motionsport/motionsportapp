import type { AssignedType, TrainingPackage } from "@/lib/api";

const SERVICE_TYPES: AssignedType[] = ["personal", "split"];

// No buying ahead, per type (as the backend checks): a type is buyable once none of its trainings are left
// in a waiting or active package. Personal left still lets the member buy split, and the other way round
export function buyableServiceTypes(packages: TrainingPackage[]): AssignedType[] {
  return SERVICE_TYPES.filter(
    (type) =>
      !packages.some((p) => p.trainingType === type && p.left > 0 && (p.state === "waiting" || p.state === "active")),
  );
}
