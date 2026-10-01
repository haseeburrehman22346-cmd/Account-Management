import { PageHeader } from "@/components/shared/page-header";
import { AccountSettings } from "@/components/profile/account-settings";

export default function AdminSettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Manage your administrator account" />
      <AccountSettings />
    </>
  );
}
