import { PageHeader } from "@/components/shared/page-header";
import { AccountSettings } from "@/components/profile/account-settings";

export default function ProfilePage() {
  return (
    <>
      <PageHeader title="My Profile" description="Manage your account details and password" />
      <AccountSettings />
    </>
  );
}
