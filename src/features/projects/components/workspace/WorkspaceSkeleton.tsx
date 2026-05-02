// =============================================================================
// WorkspaceSkeleton — loading placeholder matching ws-root 3-panel layout
// Shown while initial project data (clients, estimates, contracts, invoices)
// resolves on first workspace open.
// =============================================================================

export function WorkspaceSkeleton() {
  return (
    <div className="ws-root ws-skeleton" aria-label="Ładowanie projektu..." aria-busy>
      {/* Header bar */}
      <div className="ws-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          <div className="ws-skel ws-skel--sm" style={{ width: 24, height: 24, borderRadius: '50%' }} />
          <div className="ws-skel" style={{ width: 56, height: 14, borderRadius: 4 }} />
          <div className="ws-skel" style={{ width: 180, height: 18, borderRadius: 4 }} />
          <div className="ws-skel ws-skel--sm" style={{ width: 64, height: 20, borderRadius: 20 }} />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <div className="ws-skel ws-skel--sm" style={{ width: 60, height: 28, borderRadius: 6 }} />
          <div className="ws-skel ws-skel--sm" style={{ width: 30, height: 28, borderRadius: 6 }} />
        </div>
      </div>

      {/* Action bar */}
      <div className="ws-action-bar">
        {[90, 70, 110, 64, 84, 72].map((w, i) => (
          <div key={i} className="ws-skel ws-skel--sm" style={{ width: w, height: 26, borderRadius: 20 }} />
        ))}
        <div style={{ flex: 1 }} />
        <div className="ws-skel ws-skel--sm" style={{ width: 80, height: 28, borderRadius: 6 }} />
      </div>

      {/* 3-panel canvas */}
      <div className="ws-canvas" style={{ flex: 1 }}>
        {/* Left panel */}
        <div className="ws-left-panel">
          <SkeletonCard>
            <div className="ws-skel ws-skel--sm" style={{ width: 36, height: 10, borderRadius: 3 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
              <div className="ws-skel" style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0 }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div className="ws-skel" style={{ width: '80%', height: 13, borderRadius: 3 }} />
                <div className="ws-skel ws-skel--sm" style={{ width: '60%', height: 11, borderRadius: 3 }} />
              </div>
            </div>
            <div className="ws-skel ws-skel--sm" style={{ width: '70%', height: 11, borderRadius: 3, marginTop: 10 }} />
          </SkeletonCard>

          <SkeletonCard>
            <div className="ws-skel ws-skel--sm" style={{ width: 56, height: 10, borderRadius: 3 }} />
            <div className="ws-skel" style={{ width: '55%', height: 20, borderRadius: 3, marginTop: 10 }} />
            <div className="ws-skel ws-skel--sm" style={{ width: '100%', height: 5, borderRadius: 3, marginTop: 10 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              <div className="ws-skel ws-skel--sm" style={{ width: '40%', height: 10, borderRadius: 3 }} />
              <div className="ws-skel ws-skel--sm" style={{ width: '35%', height: 10, borderRadius: 3 }} />
            </div>
          </SkeletonCard>

          <SkeletonCard>
            <div className="ws-skel ws-skel--sm" style={{ width: 76, height: 10, borderRadius: 3 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 12 }}>
              <div className="ws-skel" style={{ width: 48, height: 48, borderRadius: '50%', flexShrink: 0 }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div className="ws-skel" style={{ width: '50%', height: 20, borderRadius: 3 }} />
                <div className="ws-skel ws-skel--sm" style={{ width: '65%', height: 11, borderRadius: 3 }} />
              </div>
            </div>
          </SkeletonCard>

          <SkeletonCard>
            <div className="ws-skel ws-skel--sm" style={{ width: 68, height: 10, borderRadius: 3 }} />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
              {[72, 62, 56].map((w, i) => (
                <div key={i} className="ws-skel ws-skel--sm" style={{ width: w, height: 24, borderRadius: 20 }} />
              ))}
            </div>
          </SkeletonCard>
        </div>

        {/* Center */}
        <div className="ws-center">
          <div className="ws-content" style={{ padding: 20 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 18, alignItems: 'flex-start' }}>
                <div className="ws-skel" style={{ width: 8, height: 8, borderRadius: '50%', marginTop: 4, flexShrink: 0 }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div className="ws-skel" style={{ width: `${55 + i * 12}%`, height: 14, borderRadius: 4 }} />
                  <div className="ws-skel ws-skel--sm" style={{ width: `${30 + i * 8}%`, height: 11, borderRadius: 3 }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right stream */}
        <div className="ws-right-stream">
          <div className="ws-stream-header">
            <div className="ws-skel ws-skel--sm" style={{ width: 64, height: 14, borderRadius: 4 }} />
          </div>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-border-light)' }}>
            <div className="ws-skel ws-skel--sm" style={{ width: 80, height: 10, borderRadius: 3, marginBottom: 10 }} />
            {[100, 130, 110].map((w, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <div className="ws-skel ws-skel--sm" style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0 }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <div className="ws-skel ws-skel--sm" style={{ width: '75%', height: 12, borderRadius: 3 }} />
                  <div className="ws-skel ws-skel--sm" style={{ width: '55%', height: 10, borderRadius: 3 }} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: '12px 14px' }}>
            <div className="ws-skel ws-skel--sm" style={{ width: 64, height: 10, borderRadius: 3, marginBottom: 10 }} />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
                <div className="ws-skel ws-skel--sm" style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0 }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div className="ws-skel ws-skel--sm" style={{ width: `${60 + i * 7}%`, height: 11, borderRadius: 3 }} />
                  <div className="ws-skel ws-skel--sm" style={{ width: '35%', height: 9, borderRadius: 3 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function SkeletonCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="ws-panel-card">
      {children}
    </div>
  )
}
