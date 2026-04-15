import React from 'react';
import { AddressNameLookup, formatAddress } from '../../utils/addressDisplay';

interface Props {
  addr: string;
  lookup: AddressNameLookup;
  showNames: boolean;
  className?: string;
}

const AddressBadge: React.FC<Props> = ({ addr, lookup, showNames, className }) => {
  const label = formatAddress(addr, lookup, showNames);
  const isLoose = label.endsWith('?');
  const tone = isLoose ? 'text-fg-dim' : 'text-fg';
  return (
    <span
      title={addr}
      className={`font-mono ${tone} ${className ?? ''}`}
    >
      {label}
    </span>
  );
};

export default AddressBadge;
