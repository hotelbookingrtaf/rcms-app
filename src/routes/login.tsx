import { createFileRoute } from "@tanstack/react-router";
import { LoginScreen } from "@/components/rcms/LoginScreen";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "เข้าสู่ระบบ · RCMS ชย.ทอ." },
      {
        name: "description",
        content: "เข้าสู่ระบบบริหารจัดเก็บรายได้ค่าไฟฟ้าและน้ำประปา กรมช่างโยธาทหารอากาศ",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  return <LoginScreen />;
}
