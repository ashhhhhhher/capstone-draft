<script setup>
import { useAuthStore } from '../stores/auth'
import { useRouter } from 'vue-router'
import { watch } from 'vue'
const authStore = useAuthStore()
const router = useRouter()

function logout() {
	authStore.logout()
	router.push({ name: 'login' })
}

// If the admin approves the account while the user is logged in, redirect them
watch(() => authStore.userRole, (newRole) => {
	if (newRole === 'member') {
		router.push({ name: 'memberHome' })
	}
})
</script>

<template>
	<div class="approval-view">
		<div class="card">
			<h2>Account Pending Approval</h2>
			<p>Please wait for the DGM head to approve your account. You will be notified once approved.</p>
			<p class="muted">You will not be able to access member features until your account is approved.</p>
			<div class="actions"><button class="btn-logout" @click="logout">Sign Out</button></div>
		</div>
	</div>
</template>

<style scoped>
.approval-view { display:flex; align-items:center; justify-content:center; height:80vh; }
.card { background:white; padding:24px; border-radius:12px; box-shadow:0 6px 20px rgba(0,0,0,0.06); max-width:560px; text-align:center }
.muted { color:#607D8B; font-size:14px }
.btn-logout { background:#D32F2F; color:white; border:none; padding:10px 16px; border-radius:8px; cursor:pointer; font-weight:700 }
</style>
