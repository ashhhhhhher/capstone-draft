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
        },
        // NEW PROFILE ROUTE ADDED HERE
        {
          path: 'profile',
          name: 'memberProfile',
          component: () => import('../views/MemberProfile.vue')
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
    // REPLACED REGISTER WITH DGROUPS
    {
      path: '/dgroups',
      name: 'dgroups',
      component: () => import('../views/Dgroups.vue'),
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

router.beforeEach((to) => {
  const authStore = useAuthStore()

  // 🔑 WAIT until auth is ready
  if (!authStore.isAuthReady) {
    return true
  }

  const isAuthenticated = !!authStore.user
  const role = authStore.userRole

  if (to.meta.requiresAuth && !isAuthenticated) {
    return { name: 'login' }
  }

  // 🚫 STOP redirects if role is unresolved
  if (isAuthenticated && !role) {
    return true
  }

  if (to.meta.role && to.meta.role !== role) {
    return { name: role === 'admin' ? 'home' : 'memberHome' }
  }

  return true
})


export default router