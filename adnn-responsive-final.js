(function(){
  'use strict';
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const isMobile = () => matchMedia('(max-width: 900px)').matches;
  const closeSidebars = () => document.body.classList.remove('mobile-menu-open','mobile-sidebar-open','sidebar-open');
  const closeFloating = (except) => {
    $$('[data-room-menu], [data-outer-menu], [data-composer-panel], [data-emoji-panel], [data-room-searchbar], .adnn-floating-reaction-sheet, .account-hover-menu, .profile-hover-menu, .user-hover-menu, .hover-menu, .dropdown-menu').forEach(el => {
      if (except && (el === except || el.contains(except))) return;
      if ('hidden' in el) el.hidden = true;
      el.classList.remove('open','is-open','active','show');
    });
    $$('.adnn-message.is-menu-open').forEach(el => el.classList.remove('is-menu-open'));
  };
  const setChatView = () => {
    const active = $('.view.active, .admin-view-panel-container[style*="display: block"], .admin-view-panel-container.active');
    const id = active && active.id;
    const chat = id === 'chat' || id === 'admin-support' || id === 'chats_view' || !!active?.querySelector?.('.adnn-chat-app');
    document.body.classList.toggle('chat-view-active', !!chat);
  };
  const normalizeBadges = () => {
    $$('[data-badge], .side-notification-badge').forEach(b => {
      const n = Number((b.textContent||'').trim());
      b.style.display = n > 0 ? 'inline-grid' : 'none';
    });
  };
  const handleMenuButton = (btn, e) => {
    if (!isMobile()) return;
    e.preventDefault();
    e.stopPropagation();
    document.body.classList.toggle('mobile-menu-open');
    document.body.classList.toggle('mobile-sidebar-open');
    document.body.classList.toggle('sidebar-open');
  };
  document.addEventListener('click', (e) => {
    const menuBtn = e.target.closest('#mobileMenuTriggerBtn, .mobile-menu-trigger, [data-mobile-menu], [aria-label*="menu" i]');
    if (menuBtn && menuBtn.classList.contains('mobile-menu-trigger')) return handleMenuButton(menuBtn, e);
    const navItem = e.target.closest('.side-nav a, .side-nav button, .sidebar-link-item');
    if (navItem && isMobile()) setTimeout(closeSidebars, 80);
    if (!e.target.closest('.adnn-room-menu, [data-room-menu-trigger], .adnn-composer-panel, [data-toggle-panel], .adnn-emoji-panel, [data-emoji-trigger], .adnn-floating-reaction-sheet, .adnn-message, .account-hover-menu, .profile-hover-menu, .user-hover-menu, .hover-menu, .dropdown-menu, [data-hover-trigger]')) closeFloating();
    if (e.target.matches('body.mobile-menu-open::after')) closeSidebars();
    setTimeout(() => { setChatView(); normalizeBadges(); }, 50);
  }, true);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeFloating(); closeSidebars(); document.querySelector('.adnn-chat-layout.is-room-open')?.classList.remove('is-room-open'); document.body.classList.remove('adnn-chat-mobile-lock'); }
  });
  window.addEventListener('resize', () => { if (!isMobile()) closeSidebars(); setChatView(); }, {passive:true});
  window.addEventListener('orientationchange', () => setTimeout(setChatView, 250), {passive:true});
  document.addEventListener('submit', setChatView, true);
  document.addEventListener('DOMContentLoaded', () => {
    normalizeBadges();
    setChatView();
    // Make logout safe if any old handler misses confirmation.
    $$('a.logout, button.logout, [data-logout], #logoutBtn, #signOutBtn').forEach(el => {
      if (el.dataset.adnnLogoutGuard === '1') return;
      el.dataset.adnnLogoutGuard = '1';
      el.addEventListener('click', (ev) => {
        if (el.dataset.adnnConfirmed === '1') return;
        if (!confirm('Log out from this account?')) { ev.preventDefault(); ev.stopImmediatePropagation(); }
        else { el.dataset.adnnConfirmed = '1'; setTimeout(()=>{ el.dataset.adnnConfirmed=''; }, 1000); }
      }, true);
    });
  });
  new MutationObserver(() => { setChatView(); normalizeBadges(); }).observe(document.documentElement, {subtree:true, childList:true, attributes:true, attributeFilter:['class','style']});
})();
