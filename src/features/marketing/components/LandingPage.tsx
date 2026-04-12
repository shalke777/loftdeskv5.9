import { useState } from 'react';

const LANDING_CSS = `
  * { -webkit-font-smoothing: antialiased; box-sizing: border-box; }

  .lp-hero-gradient {
    background: linear-gradient(160deg, #0E3D20 0%, #1A5C32 50%, #1f6b3a 100%);
  }

  /* === LAYOUT === */
  .lp-wrap { max-width: 1152px; margin: 0 auto; padding: 0 20px; }
  .lp-wrap-md { max-width: 896px; margin: 0 auto; padding: 0 20px; }
  .lp-section { padding: 80px 0; }
  @media (min-width: 640px) { .lp-section { padding: 112px 0; } }
  .lp-text-center { text-align: center; }
  .lp-section-head { margin-bottom: 56px; }

  /* === TYPOGRAPHY === */
  .lp-label {
    display: block; font-size: 0.75rem; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.1em;
    color: #1A5C32; margin-bottom: 12px;
  }
  .lp-h2 {
    font-size: clamp(1.75rem, 3.5vw, 2.5rem); font-weight: 900; color: #1a1a1a;
    line-height: 1.1; letter-spacing: -0.02em; margin: 0 0 16px;
  }
  .lp-lead { font-size: 1.125rem; color: #666666; line-height: 1.6; margin: 0; }
  .lp-lead-center {
    font-size: 1.125rem; color: #666666; line-height: 1.6;
    max-width: 640px; margin: 0 auto;
  }

  /* === ANIMATIONS === */
  @keyframes lp-slideUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
  .lp-animate-up { animation: lp-slideUp 0.6s ease both; }
  .lp-delay-1 { animation-delay: 0.1s; }
  .lp-delay-2 { animation-delay: 0.2s; }
  .lp-delay-3 { animation-delay: 0.3s; }

  /* === NAV === */
  .lp-nav {
    position: fixed; top: 0; left: 0; right: 0; z-index: 50;
    background: rgba(245, 240, 232, 0.93);
    backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
    border-bottom: 1px solid #DDD6C9;
  }
  .lp-nav-inner {
    max-width: 72rem; margin: 0 auto; padding: 0 20px;
    height: 60px; display: flex; align-items: center; justify-content: space-between;
  }
  .lp-nav-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; }
  .lp-nav-logo-icon {
    width: 28px; height: 28px; background: #1A5C32; border-radius: 8px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
  }
  .lp-nav-logo-text { font-weight: 700; font-size: 1.05rem; color: #1A5C32; letter-spacing: -0.01em; }
  .lp-nav-links {
    display: none; align-items: center; gap: 28px;
    font-size: 0.875rem; font-weight: 500;
  }
  @media (min-width: 768px) { .lp-nav-links { display: flex; } }
  .lp-nav-links a { color: #666; text-decoration: none; transition: color .15s; }
  .lp-nav-links a:hover { color: #1A5C32; }
  .lp-nav-right { display: flex; align-items: center; gap: 12px; }
  .lp-nav-login {
    display: none; font-size: 0.875rem; font-weight: 500;
    color: #666; text-decoration: none; transition: color .15s;
  }
  @media (min-width: 640px) { .lp-nav-login { display: block; } }
  .lp-nav-login:hover { color: #1A5C32; }
  .lp-nav-cta {
    background: #1A5C32; color: #fff; font-size: 0.875rem; font-weight: 600;
    padding: 8px 16px; border-radius: 8px; text-decoration: none;
    transition: background .15s; box-shadow: 0 4px 16px rgba(26,92,50,0.25);
  }
  .lp-nav-cta:hover { background: #236B3A; color: #fff; }
  .lp-nav-burger {
    display: flex; align-items: center; justify-content: center;
    width: 36px; height: 36px; border-radius: 8px;
    border: none; background: transparent; cursor: pointer; color: #666;
  }
  @media (min-width: 768px) { .lp-nav-burger { display: none; } }
  .lp-nav-mobile {
    background: rgba(245, 240, 232, 0.97); backdrop-filter: blur(20px);
    border-top: 1px solid #DDD6C9; padding: 16px 20px;
    display: flex; flex-direction: column; gap: 16px;
    font-size: 0.875rem; font-weight: 500;
  }
  .lp-nav-mobile a { color: #666; text-decoration: none; }
  .lp-nav-mobile a:hover { color: #1A5C32; }

  /* === HERO === */
  .lp-hero-inner {
    display: flex; flex-direction: column;
    max-width: 1152px; margin: 0 auto; padding: 80px 20px 0;
  }
  @media (min-width: 1024px) {
    .lp-hero-inner {
      display: grid; grid-template-columns: 1fr 460px;
      gap: 64px; align-items: center; padding: 112px 20px 0;
    }
  }
  .lp-hero-copy { margin-bottom: 56px; }
  @media (min-width: 1024px) { .lp-hero-copy { margin-bottom: 0; } }
  .lp-hero-card-wrap { display: none; }
  @media (min-width: 1024px) { .lp-hero-card-wrap { display: block; } }

  .lp-hero-badge {
    display: inline-flex; align-items: center; gap: 8px;
    background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.8);
    font-size: 0.75rem; font-weight: 600;
    padding: 6px 12px; border-radius: 100px; margin-bottom: 32px;
  }
  .lp-hero-dot { width: 6px; height: 6px; border-radius: 50%; background: #86efac; flex-shrink: 0; }
  .lp-hero-h1 {
    font-size: clamp(1.9rem, 4.2vw, 3.1rem); font-weight: 900; color: #ffffff;
    line-height: 1.06; letter-spacing: -0.02em; margin: 0 0 28px;
  }
  .lp-hero-sub {
    font-size: 1.125rem; color: rgba(255,255,255,0.65);
    line-height: 1.6; max-width: 580px; margin: 0 0 40px;
  }
  .lp-stat-badges { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 40px; }
  .lp-stat-badge {
    background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.15);
    border-radius: 12px; padding: 10px 16px;
    font-size: 0.875rem; font-weight: 600; color: #ffffff;
  }
  .lp-cta-row { display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px; }
  @media (min-width: 640px) { .lp-cta-row { flex-direction: row; } }
  .lp-btn-white {
    background: #ffffff; color: #1A5C32; font-weight: 700; font-size: 1rem;
    padding: 16px 28px; border-radius: 12px; text-decoration: none;
    text-align: center; display: block;
    box-shadow: 0 4px 20px rgba(0,0,0,0.15); transition: background 0.15s;
  }
  .lp-btn-white:hover { background: #F5F0E8; }
  .lp-btn-outline-white {
    border: 1px solid rgba(255,255,255,0.25); color: #ffffff;
    font-weight: 500; font-size: 1rem;
    padding: 16px 28px; border-radius: 12px;
    text-decoration: none; text-align: center; display: block;
    transition: background 0.15s;
  }
  .lp-btn-outline-white:hover { background: rgba(255,255,255,0.1); }
  .lp-hero-trust { font-size: 0.875rem; color: rgba(255,255,255,0.4); margin: 0; }

  /* Hero card */
  .lp-hero-card-outer { position: relative; }
  .lp-hero-card {
    background: #ffffff; border-radius: 20px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.25);
    overflow: hidden; border: 1px solid #EDE8DD;
  }
  .lp-card-header {
    background: #1A5C32; padding: 16px 20px;
    display: flex; align-items: center; justify-content: space-between;
  }
  .lp-card-badge {
    background: rgba(134,239,172,0.2); color: #86efac;
    font-size: 0.75rem; font-weight: 600; padding: 4px 10px; border-radius: 100px;
  }
  .lp-card-body { padding: 20px; }
  .lp-progress-row { display: flex; align-items: center; gap: 4px; margin-bottom: 20px; }
  .lp-dot-on { flex: 1; height: 6px; background: #1A5C32; border-radius: 100px; }
  .lp-dot-off { flex: 1; height: 6px; background: #DDD6C9; border-radius: 100px; }
  .lp-status-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 16px; }
  .lp-chip-green { background: #F5F0E8; border-radius: 12px; padding: 10px 8px; text-align: center; }
  .lp-chip-rust { background: rgba(184,116,42,0.08); border-radius: 12px; padding: 10px 8px; text-align: center; }
  .lp-next-action {
    background: rgba(26,92,50,0.05); border: 1px solid rgba(26,92,50,0.1);
    border-radius: 12px; padding: 12px; margin-bottom: 12px;
  }
  .lp-chat-row {
    background: #F5F0E8; border-radius: 12px; padding: 12px;
    display: flex; align-items: flex-start; gap: 10px;
  }
  .lp-chat-ava {
    width: 28px; height: 28px; border-radius: 50%;
    background: rgba(26,92,50,0.15);
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .lp-float-tr {
    position: absolute; top: -16px; right: -16px;
    background: #ffffff; border-radius: 16px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.12); padding: 12px 16px;
    border: 1px solid #EDE8DD;
  }
  .lp-float-bl {
    position: absolute; bottom: -16px; left: -16px;
    background: #1A5C32; color: #ffffff; border-radius: 12px;
    box-shadow: 0 4px 20px rgba(26,92,50,0.3); padding: 8px 12px;
  }
  .lp-wave-wrap { position: relative; }
  .lp-wave-wrap svg { display: block; width: 100%; }

  /* === SOCIAL PROOF BAR === */
  .lp-social-bar { background: #0E3D20; }
  .lp-social-inner {
    max-width: 1152px; margin: 0 auto; padding: 20px 20px;
    display: flex; flex-wrap: wrap; justify-content: center;
    align-items: center; gap: 12px 40px;
  }
  .lp-social-item { font-size: 0.875rem; font-weight: 600; color: rgba(255,255,255,0.7); }
  .lp-social-div { color: rgba(255,255,255,0.3); }
  @media (max-width: 639px) { .lp-social-div { display: none; } }

  /* === ROI SECTION === */
  .lp-roi-cols {
    display: grid; grid-template-columns: 1fr; gap: 24px;
    max-width: 896px; margin: 0 auto;
  }
  @media (min-width: 1024px) { .lp-roi-cols { grid-template-columns: 1fr 1fr; } }
  .lp-problem-col {
    background: #FFF0F0; border: 1px solid #FECACA;
    border-radius: 20px; padding: 28px;
  }
  .lp-solution-col {
    background: #1A5C32; border-radius: 20px; padding: 28px;
    box-shadow: 0 8px 32px rgba(26,92,50,0.25);
  }
  .lp-col-icon {
    width: 32px; height: 32px; border-radius: 8px;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .lp-problem-item {
    display: flex; align-items: flex-start;
    font-size: 14px; line-height: 1.6; color: #1a1a1a;
    padding: 10px 0; border-bottom: 1px solid rgba(0,0,0,0.06);
  }
  .lp-problem-item:last-child { border-bottom: none; }
  .lp-problem-item::before {
    content: '×'; color: #dc2626; font-weight: 700;
    font-size: 16px; margin-right: 10px; flex-shrink: 0; line-height: 1.5;
  }
  .lp-solution-item {
    display: flex; align-items: flex-start;
    font-size: 14px; line-height: 1.6; color: rgba(255,255,255,0.85);
    padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.08);
  }
  .lp-solution-item:last-child { border-bottom: none; }
  .lp-solution-item::before {
    content: '✓'; color: #86efac; font-weight: 700;
    font-size: 14px; margin-right: 10px; flex-shrink: 0; line-height: 1.5;
  }
  .lp-roi-callout {
    background: linear-gradient(135deg, #0E3D20, #1A5C32);
    border-radius: 16px; padding: 28px 32px;
    box-shadow: 0 8px 32px rgba(26,92,50,0.25);
    margin-top: 32px; max-width: 896px; margin-left: auto; margin-right: auto;
  }
  .lp-roi-callout-inner { display: flex; flex-direction: column; gap: 16px; }
  @media (min-width: 640px) { .lp-roi-callout-inner { flex-direction: row; align-items: center; } }
  .lp-btn-roi {
    flex-shrink: 0; background: #ffffff; color: #1A5C32;
    font-weight: 700; font-size: 0.875rem;
    padding: 12px 24px; border-radius: 12px;
    text-decoration: none; text-align: center;
    transition: background 0.15s; white-space: nowrap;
    box-shadow: 0 4px 16px rgba(0,0,0,0.1);
  }
  .lp-btn-roi:hover { background: #F5F0E8; }

  /* === HOW IT WORKS === */
  .lp-flow-connector {
    width: 2px; background: linear-gradient(to bottom, #3E8C58, transparent);
    margin: 0 auto; height: 32px;
  }
  .lp-number-badge {
    width: 32px; height: 32px; background: #1A5C32; color: white;
    border-radius: 50%; display: flex; align-items: center; justify-content: center;
    font-size: 13px; font-weight: 700; flex-shrink: 0;
  }
  .lp-steps-grid {
    display: none;
    grid-template-columns: repeat(7, 1fr); gap: 12px; margin-bottom: 48px;
  }
  @media (min-width: 1024px) { .lp-steps-grid { display: grid; } }
  .lp-step-col { display: flex; flex-direction: column; align-items: center; text-align: center; }
  .lp-step-icon {
    width: 48px; height: 48px; border-radius: 16px;
    background: #1A5C32; display: flex; align-items: center; justify-content: center;
    margin-bottom: 12px; box-shadow: 0 4px 16px rgba(26,92,50,0.3); flex-shrink: 0;
    transition: background 0.15s;
  }
  .lp-step-icon:hover { background: #236B3A; }
  .lp-steps-mobile { max-width: 512px; margin: 0 auto 48px; }
  @media (min-width: 1024px) { .lp-steps-mobile { display: none; } }
  .lp-step-row { display: flex; align-items: flex-start; gap: 16px; padding: 16px 0; }
  .lp-step-connector { display: flex; flex-direction: column; align-items: center; }
  .lp-metrics-grid { display: grid; grid-template-columns: 1fr; gap: 16px; }
  @media (min-width: 640px) { .lp-metrics-grid { grid-template-columns: 1fr 1fr 1fr; } }
  .lp-metric-card {
    background: #ffffff; border-radius: 20px; border: 1px solid #EDE8DD;
    padding: 24px; text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,0.04);
  }

  /* === DECISIONS === */
  .lp-decisions-grid {
    display: grid; grid-template-columns: 1fr; gap: 24px;
    max-width: 896px; margin: 0 auto 40px;
  }
  @media (min-width: 768px) { .lp-decisions-grid { grid-template-columns: 1fr 1fr 1fr; } }
  .lp-decision-card {
    background: #ffffff; border: 1px solid #EDE8DD; border-radius: 16px; padding: 24px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.06);
  }
  .lp-decision-icon {
    width: 40px; height: 40px; border-radius: 12px;
    background: rgba(26,92,50,0.1);
    display: flex; align-items: center; justify-content: center; margin-bottom: 16px;
  }
  .lp-log-box {
    background: #F5F0E8; border: 1px solid #EDE8DD;
    border-radius: 12px; padding: 12px; margin-bottom: 12px;
  }
  .lp-decisions-callout {
    max-width: 896px; margin: 0 auto;
    background: rgba(26,92,50,0.05); border: 1px solid rgba(26,92,50,0.15);
    border-radius: 16px; padding: 24px; text-align: center;
  }

  /* === PORTAL === */
  .lp-portal-layout { display: flex; flex-direction: column; gap: 56px; }
  @media (min-width: 1024px) {
    .lp-portal-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 64px; align-items: center; }
  }
  .lp-phone-wrap { display: flex; justify-content: center; }
  .lp-phone-frame {
    background: #111; border-radius: 40px; padding: 12px;
    box-shadow: 0 32px 80px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(255,255,255,0.1);
    width: 280px;
  }
  .lp-phone-screen { border-radius: 30px; overflow: hidden; background: #F5F0E8; }
  .lp-phone-notch {
    width: 80px; height: 24px; background: #111;
    border-radius: 0 0 16px 16px; margin: 0 auto;
  }
  .lp-portal-tabs { display: flex; border-bottom: 1px solid #EDE8DD; background: #ffffff; }
  .lp-portal-tab-active {
    flex: 1; padding: 10px 4px; font-size: 0.6875rem; font-weight: 700;
    color: #1A5C32; border-bottom: 2px solid #1A5C32;
    border-top: none; border-left: none; border-right: none;
    background: none; cursor: pointer;
  }
  .lp-portal-tab {
    flex: 1; padding: 10px 4px; font-size: 0.6875rem; font-weight: 500;
    color: #999999; border: none; background: none; cursor: pointer;
  }
  .lp-doc-item-green {
    display: flex; align-items: center; gap: 10px; padding: 10px; border-radius: 12px;
    background: #f0fdf4; border: 1px solid #bbf7d0;
  }
  .lp-doc-item-rust {
    display: flex; align-items: center; gap: 10px; padding: 10px; border-radius: 12px;
    background: rgba(184,116,42,0.05); border: 1px solid rgba(184,116,42,0.2);
  }
  .lp-doc-icon-green {
    width: 32px; height: 32px; border-radius: 8px; background: rgba(26,92,50,0.1);
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .lp-doc-icon-rust {
    width: 32px; height: 32px; border-radius: 8px; background: rgba(184,116,42,0.1);
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .lp-sign-btn {
    font-size: 0.625rem; font-weight: 700; color: #B8742A;
    background: rgba(184,116,42,0.1); padding: 4px 8px;
    border-radius: 8px; border: none; cursor: pointer; white-space: nowrap;
  }
  .lp-portal-chat { background: #F5F0E8; padding: 12px; border-top: 1px solid #EDE8DD; }
  .lp-portal-features { display: flex; flex-direction: column; gap: 24px; }
  .lp-feature-item { display: flex; align-items: flex-start; gap: 16px; }
  .lp-feature-icon {
    width: 40px; height: 40px; border-radius: 12px; background: rgba(26,92,50,0.1);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; margin-top: 2px;
  }
  .lp-btn-green {
    display: inline-block; background: #1A5C32; color: #ffffff;
    font-weight: 700; font-size: 0.875rem;
    padding: 14px 24px; border-radius: 12px; text-decoration: none;
    transition: background 0.15s; box-shadow: 0 4px 16px rgba(26,92,50,0.3);
  }
  .lp-btn-green:hover { background: #236B3A; }

  /* === CASE STUDY === */
  .lp-case-card {
    background: #ffffff; border: 1px solid #EDE8DD; border-radius: 20px; padding: 36px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.08); max-width: 700px; margin: 0 auto;
  }
  .lp-profile-circle {
    width: 56px; height: 56px; border-radius: 50%; background: #1A5C32;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    box-shadow: 0 4px 16px rgba(26,92,50,0.3);
  }
  .lp-blockquote {
    font-size: 1.125rem; line-height: 1.7; color: #1a1a1a; font-style: italic;
    margin: 0 0 32px; padding-left: 20px; border-left: 4px solid rgba(26,92,50,0.2);
  }
  .lp-stat-chips { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 20px; }
  .lp-stat-chip {
    background: rgba(26,92,50,0.1); color: #1A5C32;
    font-size: 0.875rem; font-weight: 600; padding: 8px 16px; border-radius: 100px;
  }

  /* === PRICING === */
  .lp-pricing-grid {
    display: grid; grid-template-columns: 1fr; gap: 24px;
    max-width: 896px; margin: 0 auto;
  }
  @media (min-width: 768px) { .lp-pricing-grid { grid-template-columns: 1fr 1fr 1fr; } }
  .lp-price-card {
    background: #ffffff; border-radius: 20px; border: 1px solid #EDE8DD;
    box-shadow: 0 1px 4px rgba(0,0,0,0.04); padding: 28px;
  }
  .lp-price-card-popular {
    background: linear-gradient(160deg, #1A5C32, #0E3D20); border-radius: 20px;
    box-shadow: 0 16px 48px rgba(26,92,50,0.30); padding: 28px; position: relative;
  }
  .lp-popular-badge-wrap {
    position: absolute; top: -14px; left: 0; right: 0; display: flex; justify-content: center;
  }
  .lp-popular-badge-inner {
    background: #B8742A; color: #ffffff; font-size: 0.75rem; font-weight: 700;
    padding: 4px 16px; border-radius: 100px; box-shadow: 0 4px 16px rgba(0,0,0,0.15);
  }
  .lp-price-cta-outline {
    display: block; text-align: center; border: 2px solid #DDD6C9; color: #1a1a1a;
    font-size: 0.875rem; font-weight: 600; padding: 12px; border-radius: 12px;
    text-decoration: none; transition: border-color 0.15s, color 0.15s; margin-bottom: 28px;
  }
  .lp-price-cta-outline:hover { border-color: #1A5C32; color: #1A5C32; }
  .lp-price-cta-white {
    display: block; text-align: center; background: #ffffff; color: #1A5C32;
    font-size: 0.875rem; font-weight: 700; padding: 12px; border-radius: 12px;
    text-decoration: none; transition: background 0.15s; margin-bottom: 28px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.1);
  }
  .lp-price-cta-white:hover { background: #F5F0E8; }
  .lp-price-cta-green {
    display: block; text-align: center; border: 2px solid #1A5C32; color: #1A5C32;
    font-size: 0.875rem; font-weight: 600; padding: 12px; border-radius: 12px;
    text-decoration: none; transition: background 0.15s; margin-bottom: 28px;
  }
  .lp-price-cta-green:hover { background: rgba(26,92,50,0.05); }
  .lp-feature-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
  .lp-feature-li { display: flex; align-items: flex-start; gap: 10px; font-size: 0.875rem; }
  .lp-check-gray {
    width: 16px; height: 16px; border-radius: 50%; background: #EDE8DD;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; margin-top: 2px; font-size: 0.625rem; font-weight: 700; color: #999999;
  }
  .lp-check-dim {
    width: 16px; height: 16px; border-radius: 50%; background: #EDE8DD;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; margin-top: 2px; font-size: 0.625rem; font-weight: 700; color: #cccccc;
  }
  .lp-check-white {
    width: 16px; height: 16px; border-radius: 50%; background: rgba(255,255,255,0.2);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; margin-top: 2px; font-size: 0.625rem; font-weight: 700; color: #ffffff;
  }
  .lp-check-green {
    width: 16px; height: 16px; border-radius: 50%; background: rgba(26,92,50,0.1);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; margin-top: 2px; font-size: 0.625rem; font-weight: 700; color: #1A5C32;
  }
  .lp-ksef-stripe {
    max-width: 896px; margin: 24px auto 0; padding: 16px 20px; border-radius: 12px;
    border: 1px solid rgba(184,116,42,0.2); background: rgba(184,116,42,0.08);
    display: flex; align-items: flex-start; gap: 12px;
  }

  /* === FINAL CTA === */
  .lp-cta-trust-grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 24px;
    margin-top: 56px; padding-top: 40px; border-top: 1px solid rgba(255,255,255,0.1);
  }
  @media (min-width: 640px) { .lp-cta-trust-grid { grid-template-columns: repeat(4, 1fr); } }
  .lp-trust-item { text-align: center; color: rgba(255,255,255,0.5); font-size: 0.875rem; }
  .lp-btn-cta {
    display: inline-block; background: #ffffff; color: #1A5C32;
    font-weight: 900; font-size: 1.125rem;
    padding: 18px 32px; border-radius: 12px; text-decoration: none;
    transition: background 0.15s; box-shadow: 0 4px 20px rgba(0,0,0,0.15);
  }
  .lp-btn-cta:hover { background: #F5F0E8; }

  /* === FOOTER === */
  .lp-footer { background: #0E3D20; padding: 40px 0; border-top: 1px solid rgba(255,255,255,0.05); }
  .lp-footer-inner { max-width: 1152px; margin: 0 auto; padding: 0 20px; }
  .lp-footer-row { display: flex; flex-direction: column; align-items: center; gap: 24px; }
  @media (min-width: 640px) { .lp-footer-row { flex-direction: row; justify-content: space-between; } }
  .lp-footer-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; }
  .lp-footer-logo-icon {
    width: 28px; height: 28px; border-radius: 8px; background: rgba(255,255,255,0.1);
    display: flex; align-items: center; justify-content: center;
  }
  .lp-footer-links { display: flex; gap: 24px; }
  .lp-footer-links a { font-size: 0.875rem; color: rgba(255,255,255,0.3); text-decoration: none; transition: color 0.15s; }
  .lp-footer-links a:hover { color: rgba(255,255,255,0.6); }
  .lp-footer-copy { margin-top: 32px; font-size: 0.75rem; color: rgba(255,255,255,0.2); }
`;

const FLOW_STEPS_DATA = [
  { num: '1', label: 'Klient', desc: 'Wpisujesz dane raz. Imię, NIP, adres — automatycznie trafiają do każdego dokumentu.' },
  { num: '2', label: 'Wycena', desc: 'Tworzysz kosztorys ręcznie lub dyktując go głosem (AI). Klient dostaje link — akceptuje bez rejestracji.' },
  { num: '3', label: 'Umowa', desc: 'Jeden klik: wycena staje się umową. Kwoty, dane klienta, zakres — już wypełnione. Dodajesz transze płatności.' },
  { num: '4', label: 'Portal', desc: 'Klient widzi projekt: dokumenty, zdjęcia postępu, wiadomości. Akceptuje zmiany. Przestaje dzwonić.' },
  { num: '5', label: 'Faktura', desc: 'Po akceptacji transzy: faktura gotowa w 30 sekund. Dane z umowy. NIP, kwota, numer — już tam są.' },
  { num: '6', label: 'KSeF', desc: 'Jeden klik: faktura wysłana do Ministerstwa Finansów. Status w systemie. Archiwum bez osobnego programu.' },
  { num: '7', label: 'Protokół', desc: 'Podpisanie elektroniczne na telefonie. Data, podpis, zakres — twardy dowód zakończenia projektu.' },
] as const;

function scrollTo(id: string) {
  return (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
}

export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <style>{LANDING_CSS}</style>

      {/* ── NAV ── */}
      <nav className="lp-nav">
        <div className="lp-nav-inner">
          <a href="/" className="lp-nav-logo">
            <div className="lp-nav-logo-icon">
              <span style={{ color: '#fff', fontWeight: 800, fontSize: '0.78rem' }}>L</span>
            </div>
            <span className="lp-nav-logo-text">LoftDesk</span>
          </a>

          <div className="lp-nav-links">
            <a href="#jak-dziala" onClick={scrollTo('jak-dziala')}>Jak działa</a>
            <a href="#portal" onClick={scrollTo('portal')}>Portal klienta</a>
            <a href="#cennik" onClick={scrollTo('cennik')}>Cennik</a>
          </div>

          <div className="lp-nav-right">
            <a href="#" className="lp-nav-login">Zaloguj</a>
            <a href="#" className="lp-nav-cta">Zacznij za darmo</a>
            <button className="lp-nav-burger" onClick={() => setMenuOpen(v => !v)} aria-label="Menu">
              {menuOpen ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="lp-nav-mobile">
            <a href="#jak-dziala" onClick={(e) => { scrollTo('jak-dziala')(e); setMenuOpen(false); }}>Jak działa</a>
            <a href="#portal" onClick={(e) => { scrollTo('portal')(e); setMenuOpen(false); }}>Portal klienta</a>
            <a href="#cennik" onClick={(e) => { scrollTo('cennik')(e); setMenuOpen(false); }}>Cennik</a>
          </div>
        )}
      </nav>

      {/* ── 1. HERO ── */}
      <section className="lp-hero-gradient" style={{ paddingBottom: 0, paddingTop: 60 }}>
        <div className="lp-hero-inner">

          {/* Left copy */}
          <div className="lp-hero-copy lp-animate-up">
            <div className="lp-hero-badge">
              <span className="lp-hero-dot" />
              System operacyjny dla firm wykończeniowych
            </div>

            <h1 className="lp-hero-h1 lp-animate-up lp-delay-1">
              Twoi klienci przestają dzwonić. Twoje projekty nie gubią dokumentów. Płatności nie czekają tygodniami.
            </h1>

            <p className="lp-hero-sub lp-animate-up lp-delay-2">
              LoftDesk to system operacyjny dla firm wykończeniowych. Jeden przepływ — od pierwszego kontaktu do zamkniętej faktury.
            </p>

            <div className="lp-stat-badges lp-animate-up lp-delay-2">
              <div className="lp-stat-badge">Średnio 3h/dzień mniej administracji</div>
              <div className="lp-stat-badge">8&times; szybsza akceptacja dokumentów</div>
              <div className="lp-stat-badge">Zero sporów dzięki logowi decyzji</div>
            </div>

            <div className="lp-cta-row lp-animate-up lp-delay-3">
              <a href="#" className="lp-btn-white">Zacznij — 14 dni za darmo</a>
              <a href="#jak-dziala" onClick={scrollTo('jak-dziala')} className="lp-btn-outline-white">Obejrzyj 3-minutowe demo</a>
            </div>
            <p className="lp-hero-trust">Bez karty kredytowej. Bez umów.</p>
          </div>

          {/* Right: hero project card (desktop only) */}
          <div className="lp-hero-card-wrap lp-animate-up lp-delay-2">
            <div className="lp-hero-card-outer">
              <div className="lp-hero-card">
                <div className="lp-card-header">
                  <div>
                    <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.625rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Projekt aktywny</p>
                    <p style={{ color: '#fff', fontWeight: 600, fontSize: '0.875rem', marginTop: 2, marginBottom: 0 }}>Mieszkanie Wiśniowa 14, Kraków</p>
                  </div>
                  <span className="lp-card-badge">W realizacji</span>
                </div>

                <div className="lp-card-body">
                  <div className="lp-progress-row">
                    <div className="lp-dot-on" /><div className="lp-dot-on" />
                    <div className="lp-dot-on" /><div className="lp-dot-on" />
                    <div className="lp-dot-off" /><div className="lp-dot-off" />
                  </div>

                  <div className="lp-status-grid">
                    <div className="lp-chip-green">
                      <p style={{ fontSize: '0.6875rem', color: '#999', margin: 0 }}>Wycena</p>
                      <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#1A5C32', marginTop: 4, marginBottom: 0 }}>Zaakc.</p>
                    </div>
                    <div className="lp-chip-green">
                      <p style={{ fontSize: '0.6875rem', color: '#999', margin: 0 }}>Umowa</p>
                      <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#1A5C32', marginTop: 4, marginBottom: 0 }}>Podp.</p>
                    </div>
                    <div className="lp-chip-rust">
                      <p style={{ fontSize: '0.6875rem', color: '#999', margin: 0 }}>Faktura</p>
                      <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#B8742A', marginTop: 4, marginBottom: 0 }}>Gotowa</p>
                    </div>
                  </div>

                  <div className="lp-next-action">
                    <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#1A5C32', marginBottom: 4, marginTop: 0 }}>Następne działanie</p>
                    <p style={{ fontSize: '0.875rem', color: '#666', margin: 0 }}>Wyślij fakturę za transzę 2 — 12 400 zł</p>
                  </div>

                  <div className="lp-chat-row">
                    <div className="lp-chat-ava">
                      <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#1A5C32' }}>K</span>
                    </div>
                    <div>
                      <p style={{ fontSize: '0.6875rem', color: '#999', marginBottom: 2, marginTop: 0 }}>Kasia · 14:22</p>
                      <p style={{ fontSize: '0.875rem', color: '#666', margin: 0 }}>Zaakceptowałam zmiany w łazience. Kiedy zaczynamy kafle?</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="lp-float-tr">
                <p style={{ fontSize: '0.6875rem', color: '#999', margin: '0 0 2px' }}>Oszczędność czasu</p>
                <p style={{ fontSize: '1.5rem', fontWeight: 900, color: '#1A5C32', margin: 0 }}>3h/dzień</p>
              </div>
              <div className="lp-float-bl">
                <p style={{ fontSize: '0.75rem', fontWeight: 600, margin: 0 }}>KSeF gotowy</p>
                <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', margin: 0 }}>Wysłano 3/3 faktur</p>
              </div>
            </div>
          </div>

        </div>

        {/* Wave */}
        <div className="lp-wave-wrap" style={{ marginTop: 80 }}>
          <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 60L60 50C120 40 240 20 360 15C480 10 600 20 720 25C840 30 960 30 1080 25C1200 20 1320 10 1380 5L1440 0V60H0Z" fill="#F5F0E8" />
          </svg>
        </div>
      </section>

      {/* ── 2. SOCIAL PROOF BAR ── */}
      <section className="lp-social-bar">
        <div className="lp-social-inner">
          <span className="lp-social-item">Ponad 200 firm w Polsce</span>
          <span className="lp-social-div">|</span>
          <span className="lp-social-item">Zgodność z KSeF od dnia 1</span>
          <span className="lp-social-div">|</span>
          <span className="lp-social-item">Wdrożenie w 15 minut</span>
          <span className="lp-social-div">|</span>
          <span className="lp-social-item">RODO &bull; serwery PL</span>
        </div>
      </section>

      {/* ── 3. ROI ── */}
      <section id="roi" className="lp-section" style={{ background: '#F5F0E8' }}>
        <div className="lp-wrap">

          <div className="lp-section-head lp-text-center">
            <p className="lp-label">Ile kosztuje chaos</p>
            <h2 className="lp-h2">Każdy miesiąc bez systemu ma cenę.</h2>
          </div>

          <div className="lp-roi-cols">

            <div className="lp-problem-col">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                <div className="lp-col-icon" style={{ background: '#FEE2E2' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </div>
                <p style={{ fontWeight: 700, color: '#b91c1c', margin: 0 }}>&times; Bez LoftDesk</p>
              </div>
              <div>
                <div className="lp-problem-item">2–3h dziennie na przepisywanie danych — 60h miesięcznie pracy administracyjnej</div>
                <div className="lp-problem-item">Klient twierdzi, że tego nie akceptował — nie masz dowodu. Sprawa trafia do prawnika.</div>
                <div className="lp-problem-item">Faktura czeka 3 tygodnie, bo klient gubi maile i nie może znaleźć co ma zapłacić</div>
                <div className="lp-problem-item">Projekt się kończy bez podpisanego protokołu. Zabezpieczenie = zero.</div>
                <div className="lp-problem-item">KSeF od 2026 obowiązkowy — kara za niezgodność: odrzucone faktury</div>
              </div>
            </div>

            <div className="lp-solution-col">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                <div className="lp-col-icon" style={{ background: 'rgba(255,255,255,0.15)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <p style={{ fontWeight: 700, color: '#ffffff', margin: 0 }}>&#x2713; Z LoftDesk</p>
              </div>
              <div>
                <div className="lp-solution-item">Dane wpisane raz — przepływają do wyceny, umowy i faktury automatycznie. Zero duplikatów.</div>
                <div className="lp-solution-item">Każda akceptacja ma timestamp i IP klienta. Spory rozstrzygasz w 5 minut.</div>
                <div className="lp-solution-item">Klient widzi fakturę w portalu — klika &ldquo;Zapłać&rdquo; lub zadaje pytanie w tym samym miejscu</div>
                <div className="lp-solution-item">Protokół odbioru podpisany elektronicznie, zarchiwizowany, z datą. Masz dowód.</div>
                <div className="lp-solution-item">KSeF wbudowany w Pro. Faktura zatwierdzona &rarr; wysłana do MF jednym klikiem.</div>
              </div>
            </div>

          </div>

          <div className="lp-roi-callout">
            <div className="lp-roi-callout-inner">
              <div style={{ flex: 1 }}>
                <p style={{ color: '#ffffff', fontWeight: 700, fontSize: '1.125rem', lineHeight: 1.4, margin: 0 }}>
                  Eliminacja 60h administracji miesięcznie = 3&nbsp;600&nbsp;zł przy stawce 60&nbsp;zł/h.
                </p>
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem', marginTop: 6, marginBottom: 0 }}>
                  LoftDesk Pro kosztuje 49 zł. Zwrot z inwestycji: 73&times;.
                </p>
              </div>
              <a href="#" className="lp-btn-roi">Zacznij za darmo</a>
            </div>
          </div>

        </div>
      </section>

      {/* ── 4. HOW IT WORKS ── */}
      <section id="jak-dziala" className="lp-section" style={{ background: '#ffffff' }}>
        <div className="lp-wrap">

          <div className="lp-section-head lp-text-center">
            <p className="lp-label">Jeden przepływ, zero przepisywania</p>
            <h2 className="lp-h2">Od pierwszego kontaktu do zamkniętej faktury — bez wychodzenia z systemu.</h2>
            <p className="lp-lead-center" style={{ marginTop: 16 }}>
              Każdy krok prowadzi naturalnie do następnego. Dane przepływają automatycznie. Klient akceptuje w czasie rzeczywistym.
            </p>
          </div>

          {/* Desktop 7-col grid */}
          <div className="lp-steps-grid">
            {FLOW_STEPS_DATA.map((step) => (
              <div key={step.num} className="lp-step-col">
                <div className="lp-step-icon">
                  <span style={{ color: '#ffffff', fontWeight: 900, fontSize: '1rem' }}>{step.num}</span>
                </div>
                <p style={{ fontWeight: 700, fontSize: '0.875rem', color: '#1a1a1a', margin: '0 0 4px' }}>{step.label}</p>
                <p style={{ fontSize: '0.75rem', color: '#666666', lineHeight: 1.5, margin: 0 }}>{step.desc}</p>
              </div>
            ))}
          </div>

          {/* Mobile vertical */}
          <div className="lp-steps-mobile">
            {FLOW_STEPS_DATA.map((step, i) => (
              <div key={step.num} className="lp-step-row">
                <div className="lp-step-connector">
                  <div className="lp-number-badge">{step.num}</div>
                  {i < 6 && <div className="lp-flow-connector" style={{ marginTop: 4 }} />}
                </div>
                <div style={{ paddingTop: 4, paddingBottom: 8 }}>
                  <p style={{ fontWeight: 700, color: '#1a1a1a', margin: '0 0 2px' }}>{step.label}</p>
                  <p style={{ fontSize: '0.875rem', color: '#666666', lineHeight: 1.6, margin: 0 }}>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="lp-metrics-grid">
            <div className="lp-metric-card">
              <p style={{ fontSize: '2.5rem', fontWeight: 900, color: '#1A5C32', margin: '0 0 8px' }}>0&times;</p>
              <p style={{ fontWeight: 600, color: '#1a1a1a', margin: '0 0 6px' }}>Przepisujesz dane</p>
              <p style={{ fontSize: '0.875rem', color: '#666', margin: 0 }}>NIP, adres, kwoty — raz wprowadzone wchodzą do każdego dokumentu</p>
            </div>
            <div className="lp-metric-card">
              <p style={{ fontSize: '2.5rem', fontWeight: 900, color: '#1A5C32', margin: '0 0 8px' }}>1 klik</p>
              <p style={{ fontWeight: 600, color: '#1a1a1a', margin: '0 0 6px' }}>Wycena staje się umową</p>
              <p style={{ fontSize: '0.875rem', color: '#666', margin: 0 }}>Dane klienta, pozycje i kwoty przepisują się automatycznie</p>
            </div>
            <div className="lp-metric-card">
              <p style={{ fontSize: '2.5rem', fontWeight: 900, color: '#B8742A', margin: '0 0 8px' }}>30 s</p>
              <p style={{ fontWeight: 600, color: '#1a1a1a', margin: '0 0 6px' }}>Faktura po akceptacji</p>
              <p style={{ fontSize: '0.875rem', color: '#666', margin: 0 }}>Dane z umowy, NIP klienta, kwota transzy — wszystko gotowe</p>
            </div>
          </div>

        </div>
      </section>

      {/* ── 5. CLIENT DECISIONS ── */}
      <section id="decyzje" className="lp-section" style={{ background: '#F5F0E8' }}>
        <div className="lp-wrap">

          <div className="lp-section-head lp-text-center">
            <p className="lp-label">Killer feature</p>
            <h2 className="lp-h2">System decyzji klienta.</h2>
            <p className="lp-lead-center" style={{ marginTop: 16 }}>
              Największy problem firm remontowych to nie brak dokumentów — to brak dowodów. LoftDesk to zmienia.
            </p>
          </div>

          <div className="lp-decisions-grid">

            <div className="lp-decision-card">
              <div className="lp-decision-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A5C32" strokeWidth="2" strokeLinecap="round">
                  <polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                </svg>
              </div>
              <p style={{ fontWeight: 900, color: '#1a1a1a', fontSize: '1rem', margin: '0 0 12px' }}>Akceptacja wyceny</p>
              <div className="lp-log-box">
                <p style={{ fontSize: '0.6875rem', color: '#999', fontWeight: 600, marginBottom: 6, marginTop: 0, fontFamily: 'monospace' }}>LOG SYSTEMOWY</p>
                <p style={{ fontSize: '0.8125rem', color: '#1a1a1a', fontFamily: 'monospace', lineHeight: 1.5, margin: 0 }}>
                  Klient: Jan Kowalski &bull; 14 marca 21:37 &bull; Zaakceptował kosztorys #WYC/2025/42 &bull; IP: 212.77.x.x
                </p>
              </div>
              <p style={{ fontSize: '0.875rem', color: '#666', lineHeight: 1.6, margin: 0 }}>To jest Twój dowód. W razie sporu — nieodwołalny.</p>
            </div>

            <div className="lp-decision-card">
              <div className="lp-decision-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A5C32" strokeWidth="2" strokeLinecap="round">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </div>
              <p style={{ fontWeight: 900, color: '#1a1a1a', fontSize: '1rem', margin: '0 0 12px' }}>Zmiana zakresu</p>
              <div className="lp-log-box">
                <p style={{ fontSize: '0.6875rem', color: '#999', fontWeight: 600, marginBottom: 6, marginTop: 0, fontFamily: 'monospace' }}>LOG SYSTEMOWY</p>
                <p style={{ fontSize: '0.8125rem', color: '#1a1a1a', fontFamily: 'monospace', lineHeight: 1.5, margin: 0 }}>
                  Zmiana #3 &bull; 21 marca 09:15 &bull; Klient zaakceptował aneks: +kafle w łazience (+4&nbsp;200&nbsp;zł) &bull; IP: 212.77.x.x
                </p>
              </div>
              <p style={{ fontSize: '0.875rem', color: '#666', lineHeight: 1.6, margin: 0 }}>Każda zmiana ma datę, treść i podpis. Zabezpiecza Ciebie i klienta.</p>
            </div>

            <div className="lp-decision-card">
              <div className="lp-decision-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A5C32" strokeWidth="2" strokeLinecap="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
                  <polyline points="9 15 12 18 15 15" /><line x1="12" y1="12" x2="12" y2="18" />
                </svg>
              </div>
              <p style={{ fontWeight: 900, color: '#1a1a1a', fontSize: '1rem', margin: '0 0 12px' }}>Odbiór projektu</p>
              <div className="lp-log-box">
                <p style={{ fontSize: '0.6875rem', color: '#999', fontWeight: 600, marginBottom: 6, marginTop: 0, fontFamily: 'monospace' }}>LOG SYSTEMOWY</p>
                <p style={{ fontSize: '0.8125rem', color: '#1a1a1a', fontFamily: 'monospace', lineHeight: 1.5, margin: 0 }}>
                  Protokół odbioru &bull; 28 marca 16:44 &bull; Podpisany przez: Jan Kowalski &bull; Zakres: pełne wykończenie kuchni
                </p>
              </div>
              <p style={{ fontSize: '0.875rem', color: '#666', lineHeight: 1.6, margin: 0 }}>Nie ma niedomówień. Nie ma &ldquo;przecież się umawialiśmy inaczej&rdquo;.</p>
            </div>

          </div>

          <div className="lp-decisions-callout">
            <p style={{ color: '#666666', fontSize: '1rem', lineHeight: 1.6, maxWidth: 640, margin: '0 auto' }}>
              Większość sporów w branży remontowej powstaje przez brak pisemnych dowodów decyzji. LoftDesk rejestruje każdą automatycznie.
            </p>
          </div>

        </div>
      </section>

      {/* ── 6. PORTAL KLIENTA ── */}
      <section id="portal" className="lp-section" style={{ background: '#ffffff', overflow: 'hidden' }}>
        <div className="lp-wrap">

          <div className="lp-section-head lp-text-center">
            <p className="lp-label">Twoja przewaga konkurencyjna</p>
            <h2 className="lp-h2">
              Twoi klienci mają swoje narzędzie.<br />
              Twoja firma wygląda inaczej niż konkurencja.
            </h2>
            <p className="lp-lead-center" style={{ marginTop: 16 }}>
              Większość firm remontowych wysyła PDF mailem i czeka. Ty dajesz klientowi portal — na telefonie, bez rejestracji, bez App Store.
            </p>
          </div>

          <div className="lp-portal-layout">

            <div className="lp-phone-wrap">
              <div className="lp-phone-frame">
                <div className="lp-phone-screen">
                  <div className="lp-phone-notch" />
                  <div style={{ background: '#1A5C32', padding: '4px 16px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.625rem' }}>9:41</span>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <div style={{ width: 12, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.4)' }} />
                        <div style={{ width: 12, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.6)' }} />
                        <div style={{ width: 12, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.9)' }} />
                      </div>
                    </div>
                    <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.625rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Twój projekt</p>
                    <p style={{ color: '#ffffff', fontWeight: 700, fontSize: '0.8125rem', lineHeight: 1.3, marginTop: 2, marginBottom: 0 }}>Mieszkanie — ul. Wiśniowa 14</p>
                  </div>

                  <div className="lp-portal-tabs">
                    <button className="lp-portal-tab-active">Dokumenty</button>
                    <button className="lp-portal-tab">Chat</button>
                    <button className="lp-portal-tab">Postęp</button>
                  </div>

                  <div style={{ background: '#ffffff', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div className="lp-doc-item-green">
                      <div className="lp-doc-icon-green">
                        <span style={{ fontSize: '0.5625rem', fontWeight: 900, color: '#1A5C32' }}>WYC</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#1a1a1a', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Kosztorys #WYC/2025/12</p>
                        <p style={{ fontSize: '0.625rem', color: '#999', margin: 0 }}>38 400 zł brutto &bull; &#x2713; Zaakceptowany</p>
                      </div>
                      <svg width="12" height="12" viewBox="0 0 20 20" fill="#16a34a">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>

                    <div className="lp-doc-item-green">
                      <div className="lp-doc-icon-green">
                        <span style={{ fontSize: '0.5625rem', fontWeight: 900, color: '#1A5C32' }}>UMW</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#1a1a1a', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Umowa #UMW/2025/12</p>
                        <p style={{ fontSize: '0.625rem', color: '#999', margin: 0 }}>3 transze &bull; &#x2713; Podpisana</p>
                      </div>
                      <svg width="12" height="12" viewBox="0 0 20 20" fill="#16a34a">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>

                    <div className="lp-doc-item-rust">
                      <div className="lp-doc-icon-rust">
                        <span style={{ fontSize: '0.5625rem', fontWeight: 900, color: '#B8742A' }}>PRO</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#1a1a1a', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Protokół odbioru</p>
                        <p style={{ fontSize: '0.625rem', color: '#999', margin: 0 }}>Oczekuje na podpis</p>
                      </div>
                      <button className="lp-sign-btn">Podpisz</button>
                    </div>
                  </div>

                  <div className="lp-portal-chat">
                    <p style={{ fontSize: '0.625rem', color: '#999', fontWeight: 600, margin: '0 0 6px' }}>Ostatnia wiadomość</p>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(26,92,50,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: '0.5625rem', fontWeight: 700, color: '#1A5C32' }}>K</span>
                      </div>
                      <p style={{ fontSize: '0.6875rem', color: '#666', lineHeight: 1.5, margin: 0 }}>Kiedy zaczynamy układanie kafli? Czy materiały już są?</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="lp-portal-features">
                <div className="lp-feature-item">
                  <div className="lp-feature-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A5C32" strokeWidth="2" strokeLinecap="round">
                      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                  </div>
                  <div>
                    <p style={{ fontWeight: 700, color: '#1a1a1a', margin: '0 0 4px' }}>Klient widzi projekt — postęp, dokumenty, terminy. Sam sprawdza zamiast pytać.</p>
                    <p style={{ fontSize: '0.875rem', color: '#666', lineHeight: 1.6, margin: 0 }}>Portal daje odpowiedzi na wszystkie pytania — bez Twojego udziału.</p>
                  </div>
                </div>

                <div className="lp-feature-item">
                  <div className="lp-feature-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A5C32" strokeWidth="2" strokeLinecap="round">
                      <polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                    </svg>
                  </div>
                  <div>
                    <p style={{ fontWeight: 700, color: '#1a1a1a', margin: '0 0 4px' }}>Akceptacje z timestampem — każda decyzja klienta jest zapisana i nieodwołalna.</p>
                    <p style={{ fontSize: '0.875rem', color: '#666', lineHeight: 1.6, margin: 0 }}>Data, godzina, IP klienta. Twardy dowód w razie sporu. Papier tego nie daje.</p>
                  </div>
                </div>

                <div className="lp-feature-item">
                  <div className="lp-feature-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A5C32" strokeWidth="2" strokeLinecap="round">
                      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                    </svg>
                  </div>
                  <div>
                    <p style={{ fontWeight: 700, color: '#1a1a1a', margin: '0 0 4px' }}>Chat w kontekście projektu — nie WhatsApp, nie email. Wiadomo o co chodzi i kiedy.</p>
                    <p style={{ fontSize: '0.875rem', color: '#666', lineHeight: 1.6, margin: 0 }}>Każda wiadomość powiązana z konkretnym projektem.</p>
                  </div>
                </div>

                <div className="lp-feature-item">
                  <div className="lp-feature-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A5C32" strokeWidth="2" strokeLinecap="round">
                      <rect x="5" y="2" width="14" height="20" rx="2" /><line x1="12" y1="18" x2="12.01" y2="18" strokeWidth={3} />
                    </svg>
                  </div>
                  <div>
                    <p style={{ fontWeight: 700, color: '#1a1a1a', margin: '0 0 4px' }}>Instalacja jak aplikacja — klient dodaje do ekranu telefonu, bez sklepu.</p>
                    <p style={{ fontSize: '0.875rem', color: '#666', lineHeight: 1.6, margin: 0 }}>Bez App Store, bez rejestracji, bez hasła.</p>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 32 }}>
                <a href="#" className="lp-btn-green">Zaproś klienta do portalu</a>
                <p style={{ fontSize: '0.75rem', color: '#999', marginTop: 8, marginBottom: 0 }}>Dostępne w planie Pro — 14 dni za darmo</p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── 7. CASE STUDY ── */}
      <section id="case-study" className="lp-section" style={{ background: '#F5F0E8' }}>
        <div className="lp-wrap">

          <div className="lp-section-head lp-text-center">
            <p className="lp-label">Wyniki z praktyki</p>
            <h2 className="lp-h2">Jak firma MMO Artis skróciła cykl fakturowania z 3 tygodni do 2 dni.</h2>
          </div>

          <div className="lp-case-card">
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 24 }}>
              <div className="lp-profile-circle">
                <span style={{ color: '#ffffff', fontWeight: 900, fontSize: '1.125rem' }}>MA</span>
              </div>
              <div>
                <p style={{ fontWeight: 700, color: '#1a1a1a', margin: '0 0 2px' }}>Marcin Artymowicz</p>
                <p style={{ fontSize: '0.875rem', color: '#666', margin: 0 }}>właściciel, MMO Artis — firma wykończeniowa, Kraków</p>
              </div>
            </div>

            <blockquote className="lp-blockquote">
              &ldquo;Przez 6 lat wysyłałem klientom pliki PDF mailem i czekałem. Klient gubił, pytał, dzwonił. Teraz wchodzi na portal, widzi fakturę, klika. Płatność przychodzi tego samego dnia. Nie zmieniłem swojej pracy — zmieniłem to, jak klient ją widzi.&rdquo;
            </blockquote>

            <div className="lp-stat-chips">
              <span className="lp-stat-chip">Cykl fakturowania: 21 dni &rarr; 2 dni</span>
              <span className="lp-stat-chip">Telefony od klientów: &minus;70%</span>
              <span className="lp-stat-chip">Wdrożenie: 1 popołudnie</span>
            </div>
            <p style={{ fontSize: '0.75rem', color: '#999', fontStyle: 'italic', margin: 0 }}>
              *Dane z wewnętrznego beta-programu LoftDesk 2025. Wyniki mogą się różnić.
            </p>
          </div>

        </div>
      </section>

      {/* ── 8. PRICING ── */}
      <section id="cennik" className="lp-section" style={{ background: '#ffffff' }}>
        <div className="lp-wrap">

          <div className="lp-section-head lp-text-center">
            <p className="lp-label">Inwestycja. Nie koszt.</p>
            <h2 className="lp-h2">Inwestycja. Nie koszt.</h2>
            <p className="lp-lead-center" style={{ marginTop: 16 }}>
              49 zł miesięcznie to mniej niż 1h Twojej pracy administracyjnej. LoftDesk eliminuje ich kilkadziesiąt.
            </p>
          </div>

          <div className="lp-pricing-grid">

            <div className="lp-price-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Free</p>
                <span style={{ background: '#EDE8DD', color: '#666', fontSize: '0.75rem', fontWeight: 600, padding: '4px 12px', borderRadius: 100 }}>Na start</span>
              </div>
              <div style={{ marginBottom: 4 }}>
                <span style={{ fontSize: '3rem', fontWeight: 900, color: '#1a1a1a' }}>0</span>
                <span style={{ color: '#999', fontWeight: 500 }}> zł/mc</span>
              </div>
              <p style={{ fontSize: '0.875rem', color: '#999', marginBottom: 24, marginTop: 0 }}>Na zawsze bezpłatny</p>
              <a href="#" className="lp-price-cta-outline">Zacznij za darmo</a>
              <ul className="lp-feature-list">
                <li className="lp-feature-li"><span className="lp-check-gray">&#x2713;</span><span style={{ color: '#666' }}>Do 5 projektów</span></li>
                <li className="lp-feature-li"><span className="lp-check-gray">&#x2713;</span><span style={{ color: '#666' }}>Do 10 klientów i faktur</span></li>
                <li className="lp-feature-li"><span className="lp-check-gray">&#x2713;</span><span style={{ color: '#666' }}>Kosztorysy, umowy, PDF</span></li>
                <li className="lp-feature-li"><span className="lp-check-dim">&mdash;</span><span style={{ color: '#ccc' }}>Portal klienta</span></li>
                <li className="lp-feature-li"><span className="lp-check-dim">&mdash;</span><span style={{ color: '#ccc' }}>KSeF</span></li>
              </ul>
            </div>

            <div className="lp-price-card-popular">
              <div className="lp-popular-badge-wrap">
                <span className="lp-popular-badge-inner">Dla aktywnych firm</span>
              </div>
              <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16, marginTop: 0 }}>Pro</p>
              <div style={{ marginBottom: 4 }}>
                <span style={{ fontSize: '3rem', fontWeight: 900, color: '#ffffff' }}>49</span>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}> zł/mc</span>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', margin: '0 0 4px' }}>= 1,6 zł dziennie</p>
              <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.5)', marginBottom: 24, marginTop: 0 }}>14 dni za darmo &middot; bez karty</p>
              <a href="#" className="lp-price-cta-white">Zacznij 14 dni za darmo</a>
              <ul className="lp-feature-list">
                <li className="lp-feature-li"><span className="lp-check-white">&#x2713;</span><span style={{ color: 'rgba(255,255,255,0.8)' }}>Bez limitu projektów i faktur</span></li>
                <li className="lp-feature-li"><span className="lp-check-white">&#x2713;</span><span style={{ color: '#ffffff', fontWeight: 600 }}>Portal klienta</span></li>
                <li className="lp-feature-li"><span className="lp-check-white">&#x2713;</span><span style={{ color: '#ffffff', fontWeight: 600 }}>KSeF — pełna integracja</span></li>
                <li className="lp-feature-li"><span className="lp-check-white">&#x2713;</span><span style={{ color: 'rgba(255,255,255,0.8)' }}>AI — kosztorys z głosu</span></li>
                <li className="lp-feature-li"><span className="lp-check-white">&#x2713;</span><span style={{ color: 'rgba(255,255,255,0.8)' }}>AI — analiza PDF projektu</span></li>
              </ul>
            </div>

            <div className="lp-price-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Business</p>
                <span style={{ background: 'rgba(26,92,50,0.1)', color: '#1A5C32', fontSize: '0.75rem', fontWeight: 600, padding: '4px 12px', borderRadius: 100 }}>Dla zespołów</span>
              </div>
              <div style={{ marginBottom: 4 }}>
                <span style={{ fontSize: '3rem', fontWeight: 900, color: '#1a1a1a' }}>119</span>
                <span style={{ color: '#999', fontWeight: 500 }}> zł/mc</span>
              </div>
              <p style={{ fontSize: '0.875rem', color: '#999', marginBottom: 24, marginTop: 0 }}>Dla firm z ekipą</p>
              <a href="#" className="lp-price-cta-green">Zacznij 14 dni za darmo</a>
              <ul className="lp-feature-list">
                <li className="lp-feature-li"><span className="lp-check-green">&#x2713;</span><span style={{ color: '#666' }}>Wszystko z Pro</span></li>
                <li className="lp-feature-li"><span className="lp-check-green">&#x2713;</span><span style={{ color: '#1a1a1a', fontWeight: 600 }}>Zarządzanie zespołem</span></li>
                <li className="lp-feature-li"><span className="lp-check-green">&#x2713;</span><span style={{ color: '#666' }}>Role i uprawnienia</span></li>
                <li className="lp-feature-li"><span className="lp-check-green">&#x2713;</span><span style={{ color: '#1a1a1a', fontWeight: 600 }}>Własne logo na dokumentach</span></li>
                <li className="lp-feature-li"><span className="lp-check-green">&#x2713;</span><span style={{ color: '#666' }}>Zaawansowane raporty</span></li>
              </ul>
            </div>

          </div>

          <div className="lp-ksef-stripe">
            <svg style={{ width: 20, height: 20, flexShrink: 0, marginTop: 1 }} viewBox="0 0 20 20" fill="#B8742A">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span style={{ fontSize: '0.875rem', color: '#92400e' }}>
              <strong>KSeF obowiązkowy od 1 lutego 2026</strong> dla wszystkich firm. Plan Pro zawiera pełną integrację — bez dodatkowych kosztów, bez konfiguracji.
            </span>
          </div>

        </div>
      </section>

      {/* ── 9. FINAL CTA ── */}
      <section className="lp-hero-gradient" style={{ padding: '80px 0' }}>
        <div className="lp-wrap" style={{ maxWidth: 768, textAlign: 'center' }}>
          <h2 style={{ fontSize: 'clamp(1.75rem, 4vw, 3rem)', fontWeight: 900, color: '#ffffff', lineHeight: 1.1, letterSpacing: '-0.02em', margin: '0 0 24px' }}>
            Twoja firma zasługuje na lepszy system.
          </h2>
          <p style={{ fontSize: '1.125rem', color: 'rgba(255,255,255,0.65)', marginBottom: 40, marginTop: 0 }}>
            Wdrożenie zajmuje <strong style={{ color: '#ffffff' }}>15 minut.</strong> Pierwszą wycenę wyślesz dzisiaj.
          </p>
          <a href="#" className="lp-btn-cta">Zacznij teraz — 14 dni Pro za darmo</a>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.875rem', marginTop: 20, marginBottom: 0 }}>
            Bez karty kredytowej. Bez umów. Możesz wrócić do Excela o każdej chwili — ale nie wrócisz.
          </p>

          <div className="lp-cta-trust-grid">
            <div className="lp-trust-item">
              <p style={{ fontSize: '1.5rem', fontWeight: 900, color: '#ffffff', margin: '0 0 4px' }}>RODO</p>
              <p style={{ fontSize: '0.75rem', margin: 0 }}>Zgodność z przepisami UE</p>
            </div>
            <div className="lp-trust-item">
              <p style={{ fontSize: '1.5rem', fontWeight: 900, color: '#ffffff', margin: '0 0 4px' }}>PL</p>
              <p style={{ fontSize: '0.75rem', margin: 0 }}>Serwery w Polsce</p>
            </div>
            <div className="lp-trust-item">
              <p style={{ fontSize: '1.5rem', fontWeight: 900, color: '#ffffff', margin: '0 0 4px' }}>SSL</p>
              <p style={{ fontSize: '0.75rem', margin: 0 }}>Szyfrowanie end-to-end</p>
            </div>
            <div className="lp-trust-item">
              <p style={{ fontSize: '1.5rem', fontWeight: 900, color: '#ffffff', margin: '0 0 4px' }}>KSeF</p>
              <p style={{ fontSize: '0.75rem', margin: 0 }}>Gotowość 2026</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <div className="lp-footer-row">
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="lp-footer-logo-icon">
                  <span style={{ color: '#ffffff', fontWeight: 900, fontSize: '0.875rem' }}>L</span>
                </div>
                <span style={{ fontWeight: 700, color: '#ffffff', fontSize: '1.125rem', letterSpacing: '-0.01em' }}>LoftDesk</span>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8125rem', margin: 0 }}>Polska aplikacja dla firm wykończeniowych</p>
            </div>
            <div className="lp-footer-links">
              <a href="#">Polityka prywatności</a>
              <a href="#">Regulamin</a>
              <a href="#">Kontakt</a>
            </div>
          </div>
          <p className="lp-footer-copy">&copy; 2025 LoftDesk. Wszelkie prawa zastrzeżone.</p>
        </div>
      </footer>
    </>
  );
}

export default LandingPage;