import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
import { useAuthStore } from '../stores/auth'

const routes = [
  // --- AUTH ---
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

  // --- MEMBER ROUTES ---
  {
    path: '/member-dashboard',
    name: 'memberDashboard',
    component: () => import('../views/MemberDashboard.vue'),
    meta: { requiresAuth: true, role: 'member' }
  },
  {
    path: '/member/attendance',
    name: 'MemberAttendance',
    component: () => import('../views/MemberAttendance.vue'),
    meta: { requiresAuth: true, role: 'member' }
  },
  {
    path: '/member/dgroup',
    name: 'MemberDgroup',
    component: () => import('../views/MemberDgroup.vue'),
    meta: { requiresAuth: true, role: 'member' }
  },
  {
    path: '/member/profile',
    name: 'MemberProfile',
    component: () => import('../views/MemberProfile.vue'),
    meta: { requiresAuth: true, role: 'member' }
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

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})


// --- NAV GUARD ---
router.beforeEach((to, from) => {
  const authStore = useAuthStore()

  const isAuthenticated = !!authStore.user
  const userRole = authStore.userRole

  if (to.meta.requiresAuth && !isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (isAuthenticated) {
    // prevent logged-in users from going to login/signup
    if (to.name === 'login' || to.name === 'signup') {
      return { name: userRole === 'admin' ? 'home' : 'memberDashboard' }
    }

    // role mismatch
    if (to.meta.role && to.meta.role !== userRole) {
      return { name: userRole === 'admin' ? 'home' : 'memberDashboard' }
    }
  }
})

export default router
