import React from 'react';
import { useParams } from 'react-router-dom';

import { TwoColumn } from '../components/TwoColumn';

import { PoetryArea } from './PoetryArea';
import { POETRY_LINKS, POEMS } from './poetryConstants';
import './poetry.css';

export const PoetryPage = () => {
  const { id } = useParams();
  const poem = id && POEMS[id];

  const poems = [{ text: 'Poems', url: '/poetry', color: 'white' }, ...POETRY_LINKS];

  return (
    <section style={{whiteSpace: 'pre-wrap', textAlign: 'center'}} className="page">
      <TwoColumn links={poems.map((link, index) => {
        return {
          text: link.text,
          url: `/poetry/${link.id}`,
          color: `var(--blue-${Math.round(index * 50 / POETRY_LINKS.length / 5) * 5})`,
        };
      })}>
        {poem ? <div className="poetry-area">{poem}</div>
          : <PoetryArea />}

      </TwoColumn>
    </section>
  );
};
