import React from 'react';
import { Header } from '../components/Header';
import { projects } from './projectConstants';

import './projects.css';

export const ProjectsPage = () =>
    <div className="page">
        <Header />
        <div className="projects">
            {projects.map(({ title, description, link }) =>
                <a href={link} className="projects__item">
                    <div>
                        <h2>{title}</h2>
                        <p>{description}</p>
                    </div>
                </a>,)}
        </div>
    </div>