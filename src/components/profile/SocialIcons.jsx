import React from 'react';
import { Github, Facebook, Linkedin, Instagram, Mail, Globe, ExternalLink, Send } from 'lucide-react';
import { SOCIAL_PLATFORMS } from '@/lib/constants';

const ICONS = {
  github: Github,
  facebook: Facebook,
  linkedin: Linkedin,
  instagram: Instagram,
  email: Mail,
  zalo: Send,
  website: Globe,
};

const LABELS = Object.fromEntries(SOCIAL_PLATFORMS.map(p => [p.key, p.label]));

function getHref(key, url) {
  if (key === 'email' && !url.startsWith('mailto:')) return `mailto:${url}`;
  if (key === 'zalo' && !url.startsWith('http')) return `https://zalo.me/${url}`;
  return url;
}

export default function SocialIcons({ links, className = '', inline = false }) {
  if (!links || typeof links !== 'object') return null;
  const entries = Object.entries(links).filter(([, v]) => v?.trim());
  if (entries.length === 0) return null;

  const iconSize = inline ? 'w-4 h-4' : 'w-4 h-4';

  return (
    <div className={`flex flex-wrap ${inline ? 'gap-1.5 items-center' : 'gap-2'} ${className}`}>
      {entries.map(([key, url]) => {
        const Icon = ICONS[key] || ExternalLink;
        return (
          <a
            key={key}
            href={getHref(key, url)}
            target="_blank"
            rel="noopener noreferrer"
            title={LABELS[key] || key}
            className="inline-flex items-center text-primary/60 hover:text-primary transition-colors"
          >
            <Icon className={iconSize} />
          </a>
        );
      })}
    </div>
  );
}
