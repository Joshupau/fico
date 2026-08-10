import { AuthCallbackPage } from '@/components/page/auth-callback/AuthCallbackPage'
import { IonContent, IonPage } from '@ionic/react'

export default function AuthCallbackIonicPage() {
  return (
    <IonPage>
      <IonContent fullscreen scrollY={false}>
        <AuthCallbackPage />
      </IonContent>
    </IonPage>
  )
}
