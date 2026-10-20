import { mount } from 'svelte';
import App from './ui/App.svelte';
import './ui/styles.css';
import { store } from './ui/store.svelte';

store.init();

export default mount(App, { target: document.getElementById('app')! });
