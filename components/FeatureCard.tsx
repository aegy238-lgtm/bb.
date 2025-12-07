import React from 'react';
import { FeatureItem } from '../types';

interface Props {
  feature: FeatureItem;
}

const FeatureCard: React.FC<Props> = ({ feature }) => {
  const Icon = feature.icon;

  return (
    <div className="p-6 rounded-2xl bg-neutral-900/40 border border-neutral-800/60 hover:border-neutral-700 transition-colors group">
      <div className="mb-4">
        <Icon size={24} className={`${feature.iconColor} mb-2`} />
      </div>
      <h4 className="text-white font-medium text-lg mb-2 group-hover:text-blue-400 transition-colors">
        {feature.title}
      </h4>
      <p className="text-gray-500 text-sm leading-relaxed">
        {feature.description}
      </p>
    </div>
  );
};

export default FeatureCard;