// Verify actual execution, including Mobile MCP's existing batch tool. A tool
// event marked completed can still contain a per-step error, so inspect output.
export function searchWasExecuted(mode, events, jev) {
  const innerUsed=!!jev?.trace?.some(t=>t.outcome==='executed'&&t.action.operation==='TYPE'&&t.action.text?.toLowerCase()==='battery saver');
  if(mode==='jev') return innerUsed;
  return (mode==='hybrid'&&innerUsed)||events.some(e=>{
    const p=e.part;
    if(e.type!=='tool_use'||p?.state?.status!=='completed') return false;
    if(p.tool==='mobile_mobile_type_keys') return p.state.input?.text?.toLowerCase()==='battery saver' && /Typed text: Battery saver/i.test(p.state.output||'');
    if(p.tool==='mobile_mobile_batch_commands') return /Step \d+ \(mobile_type_keys\): Typed text: Battery saver(?:\r?\n|$)/i.test(p.state.output||'');
    return false;
  });
}
