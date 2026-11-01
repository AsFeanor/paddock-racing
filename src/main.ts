import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './style.css'
import './experience.css'
import './polish.css'
import './theme.css'

createApp(App).use(createPinia()).mount('#app')
