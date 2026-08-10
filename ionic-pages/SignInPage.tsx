import { SigninForm } from "@/components/page/signin/SigninForm";
import { IonContent, IonPage } from '@ionic/react'

export default function SignInPage() {
  return (
    <IonPage>
      <IonContent fullscreen>
        <div className="min-h-screen flex items-center justify-center bg-[#f5f5f5] dark:bg-zinc-950 px-5 py-12">
          <SigninForm />
        </div>
      </IonContent>
    </IonPage>
  )
}
