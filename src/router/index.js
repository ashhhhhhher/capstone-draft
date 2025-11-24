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
      path: '/signup',
      name: 'signup',
      component: () => import('../views/Signup.vue')
    },
    
    // --- MEMBER APP ROUTES ---
    {
      path: '/member',
      // UPDATED: Points to src/layout/MemberLayout.vue
      component: () => import('../layout/MemberLayout.vue'), 
      meta: { requiresAuth: true, role: 'member' },
      children: [
        {
          path: '', 
          redirect: { name: 'memberHome' }
        },
        {
          path: 'home',
          name: 'memberHome',
          // Points to src/views/MemberHome.vue
          component: () => import('../views/MemberHome.vue') 
        },
        {
          path: 'dgroup',
          name: 'memberDgroup',
          component: () => import('../views/MemberDgroup.vue')
        },
        {
          path: 'attendance',
          name: 'memberAttendance',
          component: () => import('../views/MemberAttendance.vue')
        },
        {
          path: 'qr',
          name: 'memberQR',
          component: () => import('../views/MemberQR.vue')
        }
      ]
    },

    // --- ADMIN ROUTES ---
    {
      path: '/',
      name: 'home',
      component: Home,
      meta: { requiresAuth: true, role: 'admin' }
    },
    {
      path: '/members',
      name: 'members',
      component: () => import('../views/Members.vue'),
      meta: { requiresAuth: true, role: 'admin' }
    },
    {
      path: '/scan',
      name: 'scan',
      component: () => import('../views/Scan.vue'),
      meta: { requiresAuth: true, role: 'admin' }
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('../views/Register.vue'),
      meta: { requiresAuth: true, role: 'admin' }
    },
    {
      path: '/insights',
      name: 'insights',
      component: () => import('../views/Insights.vue'),
      meta: { requiresAuth: true, role: 'admin' }
    },
    {
      path: '/profile',
      name: 'profile',
      component: () => import('../views/Profile.vue'),
      meta: { requiresAuth: true, role: 'admin' }
    }
  ]
})

// --- Navigation Guard ---
router.beforeEach((to, from) => {
  const authStore = useAuthStore()
  const isAuthenticated = !!authStore.user
  const userRole = authStore.userRole

  if (to.meta.requiresAuth && !isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (isAuthenticated) {
    if (to.name === 'login' || to.name === 'signup') {
      return { name: userRole === 'admin' ? 'home' : 'memberHome' }
    }
    // Prevent cross-role access
    if (to.meta.role && to.meta.role !== userRole) {
      return { name: userRole === 'admin' ? 'home' : 'memberHome' }
    }
  }
})

export default router