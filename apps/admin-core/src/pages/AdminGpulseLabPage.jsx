import React, { memo, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminSidebar } from '../components/AdminSidebar.jsx';
import { AdminTopBar } from '../components/AdminTopBar.jsx';
import GPulseLab from '../gpulse-lab/GPulseLab.jsx';

/**
 * GPulse Lab dentro del layout del panel admin (top bar + sidebar), ruta `/admin/gpulse-lab`.
 */
function AdminGpulseLabPageInner() {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const toggleCollapsed = useCallback(() => setCollapsed((c) => !c), []);

  const onViewChange = useCallback(
    (id) => {
      navigate('/admin', { state: { adminView: id } });
    },
    [navigate],
  );

  return (
    <div
      className="admin-layout flex h-full min-h-0 flex-1 flex-col overflow-hidden"
      style={{ backgroundColor: '#0D1117' }}
    >
      <AdminTopBar activeView="gpulse-lab" />

      <div className="admin-body flex min-h-0 flex-1 overflow-hidden">
        <AdminSidebar
          view="gpulse-lab"
          onViewChange={onViewChange}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
        />

        <div
          className="admin-content custom-scrollbar flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-auto p-0"
          style={{ backgroundColor: '#0D1117' }}
        >
          <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
            <GPulseLab />
          </div>
        </div>
      </div>
    </div>
  );
}

export const AdminGpulseLabPage = memo(AdminGpulseLabPageInner);
AdminGpulseLabPage.displayName = 'AdminGpulseLabPage';
