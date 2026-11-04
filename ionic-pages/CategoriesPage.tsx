import { useState } from 'react'
import CategoryList from '@/components/categories/category-list'
import { IonPage, IonContent } from '@ionic/react'
import { CategoriesHeader } from '@/components/page/categories/categories-header'
import CategoryModal from '@/components/categories/category-modal'

export default function CategoriesPage() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  
  return (
    <IonPage>
      <IonContent className="bg-background text-foreground transition-colors duration-300">
        <div className="p-6 max-w-7xl mx-auto">
          <CategoriesHeader 
            onAddCategory={() => setIsModalOpen(true)}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
          
          <CategoryList searchQuery={searchQuery} />
          
          <CategoryModal 
            open={isModalOpen} 
            onClose={() => setIsModalOpen(false)} 
          />
        </div>
      </IonContent>
    </IonPage>
  )
}

