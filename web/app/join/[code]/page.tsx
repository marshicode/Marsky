import { JoinForm } from "@/components/join-form";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <JoinForm initialCode={code} />;
}
