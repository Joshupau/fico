import { OnboardingPage } from '@/components/page/onboarding/OnboardingPage'
import { IonContent, IonPage } from '@ionic/react'

export default function OnboardingIonicPage() {
  return (
    <IonPage>
      <IonContent fullscreen scrollY={false}>
        <OnboardingPage />
      </IonContent>
    </IonPage>
  )
}
