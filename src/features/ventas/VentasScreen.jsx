import { T } from '../../shared/ui';
import IgssGomeraTab from './IgssGomeraTab';
import EmpresasTab   from './EmpresasTab';

export function VentasScreen({ view }) {
  const Tab = view === 'ventas_igss' ? IgssGomeraTab : EmpresasTab;
  return (
    <div style={{ padding: 24 }}>
      <Tab />
    </div>
  );
}
