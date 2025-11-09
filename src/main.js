import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { Chart as ChartJS, Title, Tooltip, Legend, ArcElement, BarElement, CategoryScale, LinearScale } from 'chart.js'
import ChartDataLabels from 'chartjs-plugin-datalabels';

import App from './App.vue'
import router from './router'
import './style.css' 
import { useAuthStore } from './stores/auth'

// Register Chart.js components
ChartJS.register(
  Title, 
  Tooltip, 
  Legend, 
  ArcElement, 
  BarElement, 
  CategoryScale, 
  LinearScale,
  ChartDataLabels
)

// This is the new async startup function
async function startup() {
  const pinia = createPinia()
  const app = createApp(App)

  app.use(pinia)

  // --- THIS IS THE FIX ---
  // 1. Initialize the auth store
  const authStore = useAuthStore()

  // 2. WAIT for the init() promise to resolve.
  // This contacts Firebase and gets the user's role.
  await authStore.init()

  // 3. NOW that we know who the user is, we can
  // safely load the router and mount the app.
  app.use(router)
  app.mount('#app')
}

// Start the app
startup()