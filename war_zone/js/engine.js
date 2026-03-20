// Three.js scene setup: scene, camera, renderer, controls

import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);
export const renderer = new THREE.WebGLRenderer({ antialias: true });

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

export const controls = new PointerLockControls(camera, document.body);

// Movement constants
export const moveSpeed = 8;
export const sprintMult = 1.6;
export const jumpForce = 12;
export const gravity = 30;

// Movement state
export const velocity = new THREE.Vector3();
export const direction = new THREE.Vector3();
export const keys = { w: false, a: false, s: false, d: false, shift: false, space: false, e: false };
export let canJump = true;
export function setCanJump(v) { canJump = v; }

// Raycaster
export const raycaster = new THREE.Raycaster();

// Obstacles and wall bounds (populated by map builder)
export let obstacles = [];
export let wallBounds = [];
export function setObstacles(o) { obstacles = o; }
export function setWallBounds(w) { wallBounds = w; }

// Weapon view model
export let weaponModel = null;
export let weaponSwingTime = 0;
export function setWeaponModel(m) { weaponModel = m; }
export function setWeaponSwingTime(t) { weaponSwingTime = t; }

// Resize handler
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
