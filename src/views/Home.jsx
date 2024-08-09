import React from 'react';
import { Header } from '../components/Header';
import headshot from '../assets/photos_of_me/headshot.jpeg';

import './home.css';

export const Home = () =>
    <div style={{position: 'relative'}}>
        <Header />
        <div className="home">
            <h2>Welcome to</h2>
            <h1>TommysThoughts.com!</h1>
            <a href="/personal/Resume_Thomas_Madden.pdf" className="home__profile-cont" style={{borderRadius: '50%'}}>
                <img src={headshot} alt="" className="home__profile-pic" />
            </a>
            <span className="home__headline">
                Senior Engineering Manager at Aetna Digital, Inc.
            </span>
            <hr />
        </div>
    </div>;
