// Avatar + status ring, animated — deferred until LiveMapScreen's real map/socket
// pass (see WHAT NOT TO BUILD YET). Placeholder so imports don't break navigation.
import React from 'react';

interface MemberPinProps {
  avatarIndex: number;
  status: 'active' | 'stale' | 'alert';
}

export function MemberPin(_props: MemberPinProps) {
  return null;
}
