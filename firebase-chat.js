right: clamp(24px, 3.5vw, 48px); /* Shifted inwards from 34px maximum for a perfect grid gutter look */
bottom: var(--ai-orb-bottom, clamp(24px, 3.5vw, 48px)); /* JS pins this above the contact panel before it enters the black box */
z-index: 999998;
    width: 64px;
    height: 64px;
    width: 38px;
    height: 38px;
border: 0;
border-radius: 50%;
display: grid;
@@ -2439,15 +2439,22 @@
}
/* Custom SVG Sizing & Center Vector Fitting Rules */
#aiComingSoonOrb .ai-icon-embed {
    width: 46px;
    height: 46px;
    width: 28px;
    height: 28px;
position: relative;
z-index: 3;
display: block;
object-fit: contain;
    filter: drop-shadow(0 1px 4px rgba(0, 30, 120, 0.4)) drop-shadow(0 0 10px rgba(255, 255, 255, 0.85));
    transform: rotate(0deg) scale(1);
    transform-origin: center center;
    filter:
      drop-shadow(0 0 10px rgba(255,255,255,0.9))
      drop-shadow(0 0 18px rgba(120,190,255,0.8))
      drop-shadow(0 0 28px rgba(60,130,255,0.65));
pointer-events: none;
    transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    transition:
      transform 0.85s cubic-bezier(0.16, 1, 0.3, 1),
      filter 0.45s cubic-bezier(0.16, 1, 0.3, 1);
}

#aiComingSoonOrb .ai-tooltip {
@@ -2480,8 +2487,13 @@
transform: translateY(-2px) scale(1.04);
}
#aiComingSoonOrb:hover .ai-icon-embed {
    transform: scale(1.08) rotate(8deg);
  }
    transform: rotate(360deg) scale(1.16);
    filter:
      drop-shadow(0 0 14px rgba(255,255,255,1))
      drop-shadow(0 0 28px rgba(120,190,255,1))
      drop-shadow(0 0 44px rgba(70,140,255,0.9))
      drop-shadow(0 0 60px rgba(70,140,255,0.6));
}
#aiComingSoonOrb:hover .ai-tooltip {
opacity: 1;
transform: translateY(0) scale(1);
@@ -3043,25 +3055,26 @@ <h2 class="big" style="line-height:1.02">Let’s make the brand feel Inevitable.
}

function updateAiOrbPin() {
		        const aiOrb = document.getElementById("aiComingSoonOrb");
		        const connectPanel = document.querySelector("#connect form") || document.getElementById("connect");
		        if (!aiOrb || !connectPanel) return;

		        const baseBottom = window.innerWidth <= 560 ? 20 : 34;
		        const panelGap = window.innerWidth <= 560 ? 16 : 22;
		        const panelRect = connectPanel.getBoundingClientRect();
		        const orbHeight = aiOrb.offsetHeight || 58;
		        let nextBottom = baseBottom;

		        if (panelRect.top < window.innerHeight - baseBottom - orbHeight - panelGap) {
		          nextBottom = Math.min(
		            window.innerHeight - orbHeight - panelGap,
		            window.innerHeight - panelRect.top + panelGap
		          );
		        }
  const aiOrb = document.getElementById("aiComingSoonOrb");
  const connectSection = document.getElementById("connect");
  if (!aiOrb || !connectSection) return;

		        aiOrb.style.setProperty("--ai-orb-bottom", `${Math.max(baseBottom, Math.round(nextBottom))}px`);
		      }
  const baseBottom = window.innerWidth <= 560 ? 20 : 34;
  const safeGap = window.innerWidth <= 560 ? 18 : 28;
  const orbHeight = aiOrb.offsetHeight || 38;
  const connectTop = connectSection.getBoundingClientRect().top;

  const normalOrbTop = window.innerHeight - baseBottom - orbHeight;
  const limitTop = connectTop - safeGap - orbHeight;

  let nextBottom = baseBottom;

  if (normalOrbTop > limitTop) {
    nextBottom = window.innerHeight - connectTop + safeGap;
  }

  aiOrb.style.setProperty("--ai-orb-bottom", `${Math.round(Math.max(baseBottom, nextBottom))}px`);
}

backToTopBtn.addEventListener("click", function(event) {
event.preventDefault();
