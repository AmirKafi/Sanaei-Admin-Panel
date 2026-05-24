import { SubscriptionInfo } from "@/components/subscription-info"

export default async function SubPage({
  params,
}: {
  params: Promise<{ subId: string }>
}) {
  const { subId } = await params
  return <SubscriptionInfo subId={subId} />
}
