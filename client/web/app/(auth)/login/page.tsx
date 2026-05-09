import { redirect } from "next/navigation";
import { BusIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { GoogleButton } from "../_components/GoogleButton";

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    redirect("/");
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-[#dff8f2] px-4 py-10 text-[#25302b]">
      <div className="flex w-full max-w-[420px] flex-col gap-4">
        <header className="flex items-center gap-3 rounded-[1.5rem] border-4 border-[#313131] bg-white px-4 py-4 shadow-[0_6px_0_#313131]">
          <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[#58cc02] text-white shadow-[0_4px_0_#2f8d12]">
            <BusIcon className="size-7" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-black text-[#58a700]">みんなで動かす</p>
            <h1 className="text-2xl font-black leading-tight">
              バス停ロボット
            </h1>
          </div>
        </header>

        <section className="rounded-[1.5rem] border-4 border-[#313131] bg-white p-5 shadow-[0_6px_0_#313131]">
          <h2 className="text-lg font-black">ようこそ</h2>
          <p className="mt-1 text-xs font-bold text-[#53635a]">
            ログインすると、コメント投稿や 1人1票の応援、あなたが動かしたバス停のレポートが利用できます。
          </p>

          <div className="mt-4">
            <GoogleButton />
          </div>

          <p className="mt-3 text-center text-[10px] font-bold text-[#53635a]">
            初めての方も同じボタンからアカウント作成できます。
          </p>
        </section>
      </div>
    </main>
  );
}
