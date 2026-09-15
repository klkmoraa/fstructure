import { useContext, useState } from 'react';
import { ConcreteBeamDesignSurface } from '../../design/ConcreteBeamDesignSurface';
import { DesignSurfaceContext } from './surfaceContexts';

export default function DesignSurface() {
  const shellProps = useContext(DesignSurfaceContext);
  const [open, setOpen] = useState(true);
  return <ConcreteBeamDesignSurface nativeTool {...(shellProps ?? {
    open, status: open ? 'active' : 'closed', presentation: 'fullscreen', onOpenChange: setOpen,
  })} />;
}
