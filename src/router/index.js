import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
import { useAuthStore } from '../stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/Login.vue')
    },
    {
      path: '/',
      name: 'home',
      component: Home,
      meta: { requiresAuth: true }
    },
    {
      path: '/members',
      name: 'members',
      component: () => import('../views/Members.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/scan',
      name: 'scan',
      component: () => import('../views/Scan.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('../views/Register.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/insights',
      name: 'insights',
      component: () => import('../views/Insights.vue'),
      meta: { requiresAuth: true }
    },
    // --- NEW PROFILE ROUTE ---
    {
      path: '/profile',
      name: 'profile',
      component: () => import('../views/Profile.vue'),
      meta: { requiresAuth: true }
    }
  ]
})

// --- Navigation Guard ---
router.beforeEach(async (to, from) => {
  const authStore = useAuthStore()

  if (!authStore.isAuthReady) {
    await authStore.init()
  }

  if (to.meta.requiresAuth && !authStore.user) {
    return { 
      name: 'login',
      query: { redirect: to.fullPath } 
    }
  }

  if (to.name === 'login' && authStore.user) {
    return { name: 'home' }
  }
})

export default router