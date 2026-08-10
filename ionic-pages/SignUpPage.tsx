import { SignupForm } from "@/components/page/signup/SignupForm";
import { IonContent, IonPage } from '@ionic/react'

export default function SignUpPage() {
  return (
    <IonPage>
      <IonContent fullscreen>
        <div className="min-h-screen flex items-center justify-center bg-[#f5f5f5] dark:bg-zinc-950 px-5 py-12">
          <SignupForm />
        </div>
      </IonContent>
    </IonPage>
  )
}
