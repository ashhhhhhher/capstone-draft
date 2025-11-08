import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { Chart as ChartJS, Title, Tooltip, Legend, ArcElement, BarElement, CategoryScale, LinearScale } from 'chart.js'
import ChartDataLabels from 'chartjs-plugin-datalabels'; // 1. Import the new plugin

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
  ChartDataLabels // 2. Register the new plugin
)

const pinia = createPinia()
const app = createApp(App)

app.use(pinia)
app.use(router)

const authStore = useAuthStore()
authStore.init()

app.mount('#app')