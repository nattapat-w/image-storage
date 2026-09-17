import { ShareFolderInviteAccept } from "@/components/share/ShareFolderInviteAccept";

type Props = {
  params: Promise<{ token: string }>;
};

export default async function ShareFolderInvitePage({ params }: Props) {
  const { token } = await params;
  return <ShareFolderInviteAccept token={token} />;
}
