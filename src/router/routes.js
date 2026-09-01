import { vitals } from '@/lib/vitals.js'

// The tabs the saved `lastTab` is allowed to name. A hand-edited blob in
// localStorage must not be able to aim the redirect at an arbitrary path.
const TABS = ['/os/vitals', '/os/log', '/os/trends', '/os/me']

const routes = [
  // Opening the app opens the app. The invite is the thing you go and do from
  // inside it, not the doorway you have to walk through every time — most
  // visits are to the diary, and the question only gets asked now and then.
  { path: '/', redirect: '/os' },

  // The invite, once the front door and now a room off it. Reached from the
  // header's 💌, from the Us tab, and from the summary when no date is planned.
  {
    path: '/invite',
    component: () => import('@/pages/DateInvite.vue'),
  },

  // Love Vitals. A nested route rather than four flat ones so the shell (the
  // header, the tab bar, the console cabinet) mounts once and only the page
  // inside it swaps, which is what keeps the tab bar from flickering on every
  // tap.
  {
    path: '/os',
    component: () => import('@/pages/LoveOs.vue'),
    children: [
      // Reopening the installed app lands on the tab she left it on, the way
      // every other app on the phone behaves. Falls back to the summary.
      {
        path: '',
        redirect: () => (TABS.includes(vitals.lastTab) ? vitals.lastTab : '/os/vitals'),
      },
      { path: 'vitals', component: () => import('@/pages/os/VitalsPage.vue') },
      { path: 'log', component: () => import('@/pages/os/LogPage.vue') },
      { path: 'trends', component: () => import('@/pages/os/TrendsPage.vue') },
      { path: 'me', component: () => import('@/pages/os/MePage.vue') },
    ],
  },

  // Always leave this as last one,
  // but you can also remove it
  {
    path: '/:catchAll(.*)*',
    component: () => import('@/pages/ErrorNotFound.vue'),
  },
]

export default routes
