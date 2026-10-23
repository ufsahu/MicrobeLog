import { createFileRoute } from "@tanstack/react-router";
import { seo } from "@/lib/seo";
import { PatientView } from "@/components/PatientView";

export const Route = createFileRoute("/patients/$id")({
  head: ({ params }) => seo(`Patient ${params.id}`, `Cultures, isolates, bacterial load and susceptibility results for synthetic patient ${params.id}.`),
  component: PatientPage,
});

function PatientPage() {
  const { id } = Route.useParams();
  return <PatientView id={id} />;
}
