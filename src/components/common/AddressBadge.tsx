import React from 'react';
import { AddressNameLookup } from '../../utils/addressDisplay';

interface Props {
  addr: string;
  lookup: AddressNameLookup;
  showNames: boolean;
  className?: string;
}

const AddressBadge: React.FC<Props> = ({ addr, lookup, showNames, className }) => {
  const key = addr.toLowerCase();
  const strict = showNames ? lookup.strict.get(key) : undefined;
  const loose = showNames && !strict ? lookup.loose.get(key) : undefined;
  const name = strict ?? loose;
  const isLoose = !strict && !!loose;
  return (
    <span title={addr} className={`font-mono text-fg ${className ?? ''}`}>
      {addr}
      {name && (
        <span className={'ml-1.5 ' + (isLoose ? 'text-fg-dim' : 'text-mint')}>
          · {name}{isLoose ? '?' : ''}
        </span>
      )}
    </span>
  );
};

export default AddressBadge;
